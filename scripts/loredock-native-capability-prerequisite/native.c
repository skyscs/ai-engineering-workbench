#define _GNU_SOURCE
#include <errno.h>
#include <fcntl.h>
#include <inttypes.h>
#include <limits.h>
#include <linux/capability.h>
#include <linux/magic.h>
#include <linux/sched.h>
#include <poll.h>
#include <signal.h>
#include <stdbool.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/prctl.h>
#include <sys/stat.h>
#include <sys/statfs.h>
#include <sys/syscall.h>
#include <sys/types.h>
#include <sys/wait.h>
#include <time.h>
#include <unistd.h>

/* The trusted control parent stays outside the measured leaf. No fork/migrate fallback. */
#define PATH_BOUND 1024
#define READ_BOUND 4096
#define NATIVE_WALL_NS UINT64_C(4000000000)

struct birth_record {
    uint64_t pid, start_ticks, uid, gid, observed_ns;
    char placement[PATH_BOUND];
};

static uint64_t now_ns(void) {
    struct timespec value;
    if (clock_gettime(CLOCK_MONOTONIC, &value) != 0 || value.tv_sec < 0)
        return 0;
    return (uint64_t)value.tv_sec * UINT64_C(1000000000) + (uint64_t)value.tv_nsec;
}

static bool decimal(const char *text, uint64_t *value) {
    if (!text || !*text || (text[0] == '0' && text[1])) return false;
    uint64_t number = 0;
    for (const unsigned char *p = (const unsigned char *)text; *p; p++) {
        if (*p < '0' || *p > '9' || number > (UINT64_MAX - (*p - '0')) / 10) return false;
        number = number * 10 + (*p - '0');
    }
    *value = number;
    return true;
}

static bool safe_group(const char *path) {
    size_t size = strlen(path);
    if (!size || size >= PATH_BOUND || path[0] != '/' || strstr(path, "..") || strstr(path, "//")) return false;
    for (const unsigned char *p = (const unsigned char *)path; *p; p++)
        if (!((*p >= 'a' && *p <= 'z') || (*p >= 'A' && *p <= 'Z') || (*p >= '0' && *p <= '9') || strchr("/_@.:-", *p))) return false;
    return true;
}

static bool related_groups(const char *parent, const char *target) {
    const char suffix[] = "/attestor";
    size_t size = strlen(parent), tail = sizeof(suffix) - 1;
    return safe_group(parent) && safe_group(target) && size > tail
        && strcmp(parent + size - tail, suffix) == 0
        && strlen(target) == size - tail + strlen("/run/probe")
        && strncmp(parent, target, size - tail) == 0
        && strcmp(target + size - tail, "/run/probe") == 0;
}

static int read_small(const char *path, char *output, size_t capacity) {
    if (capacity < 2) { errno = EINVAL; return -1; }
    int fd = open(path, O_RDONLY | O_CLOEXEC | O_NOFOLLOW);
    if (fd < 0) return -1;
    size_t used = 0;
    for (;;) {
        ssize_t count = read(fd, output + used, capacity - used);
        if (count < 0 && errno == EINTR) continue;
        if (count < 0) { int error = errno; close(fd); errno = error; return -1; }
        if (!count) { output[used] = '\0'; close(fd); return 0; }
        used += (size_t)count;
        if (used == capacity) { close(fd); errno = EOVERFLOW; return -1; }
    }
}

static bool placement_matches(const char *raw, const char *expected) {
    size_t size = strlen(expected);
    return strlen(raw) == size + 4 && strncmp(raw, "0::", 3) == 0
        && strncmp(raw + 3, expected, size) == 0 && raw[size + 3] == '\n';
}

static bool start_identity(char *raw, pid_t pid, uint64_t *start) {
    char *first = strchr(raw, ' '), *last = strrchr(raw, ')');
    if (!first || !last || first >= last || last[1] != ' ') return false;
    *first = '\0';
    uint64_t observed;
    if (!decimal(raw, &observed) || observed != (uint64_t)pid) return false;
    char *save = NULL, *part = strtok_r(last + 2, " \n", &save);
    for (int index = 0; part && index < 19; index++) part = strtok_r(NULL, " \n", &save);
    return part && decimal(part, start) && *start > 0;
}

static int target_identity(int fd, uint64_t device, uint64_t inode) {
    struct stat info;
    struct statfs filesystem;
    int flags = fcntl(fd, F_GETFL);
    if (flags < 0) return -1;
    if ((flags & O_ACCMODE) != O_RDONLY) { errno = EINVAL; return -1; }
    if (fstat(fd, &info) || fstatfs(fd, &filesystem)) return -1;
    if (!S_ISDIR(info.st_mode) || (uint64_t)info.st_dev != device || (uint64_t)info.st_ino != inode
        || filesystem.f_type != CGROUP2_SUPER_MAGIC || info.st_uid != getuid() || info.st_gid != getgid()) {
        errno = EINVAL;
        return -1;
    }
    return 0;
}

static pid_t spawn_direct(int target, int *pidfd) {
    struct clone_args args = {0};
    _Static_assert(sizeof(args) >= CLONE_ARGS_SIZE_VER2, "Missing clone3 cgroup ABI");
    args.flags = CLONE_INTO_CGROUP | CLONE_PIDFD;
    args.pidfd = (uint64_t)(uintptr_t)pidfd;
    args.exit_signal = SIGCHLD;
    args.cgroup = (uint64_t)target;
    return (pid_t)syscall(SYS_clone3, &args, (size_t)CLONE_ARGS_SIZE_VER2);
}

static int require_no_new_privileges(void) {
    int value = prctl(PR_GET_NO_NEW_PRIVS, 0UL, 0UL, 0UL, 0UL);
    if (value == 1) return 0;
    if (value >= 0) errno = EPERM;
    return -1;
}

static int reduce_capabilities(const char **stage) {
    _Static_assert(_LINUX_CAPABILITY_U32S_3 == 2, "Missing two-word capability ABI");
    *stage = "no-new-privileges-before";
    if (require_no_new_privileges()) return -1;
    struct __user_cap_header_struct header = {.version = _LINUX_CAPABILITY_VERSION_3, .pid = 0};
    struct __user_cap_data_struct zero[_LINUX_CAPABILITY_U32S_3] = {{0}};
    *stage = "capset";
    /* Only the calling native control thread is changed, and every requested bit is zero. */
    long result = syscall(SYS_capset, &header, zero);
    if (result != 0) { if (result > 0) errno = EPROTO; return -1; }
    struct __user_cap_data_struct observed[_LINUX_CAPABILITY_U32S_3];
    memset(observed, 0xff, sizeof(observed));
    header.version = _LINUX_CAPABILITY_VERSION_3;
    header.pid = 0;
    *stage = "capget";
    result = syscall(SYS_capget, &header, observed);
    if (result != 0) { if (result > 0) errno = EPROTO; return -1; }
    *stage = "capability-readback";
    if (header.version != _LINUX_CAPABILITY_VERSION_3 || header.pid != 0) { errno = EPROTO; return -1; }
    for (size_t i = 0; i < _LINUX_CAPABILITY_U32S_3; i++)
        if (observed[i].effective || observed[i].permitted || observed[i].inheritable) { errno = EPERM; return -1; }
    *stage = "no-new-privileges-after";
    return require_no_new_privileges();
}

static pid_t spawn_admitted(int target, int *pidfd, const char **stage) {
    if (reduce_capabilities(stage)) return -1;
    *stage = "clone3";
    return spawn_direct(target, pidfd);
}

static int ready(int fd, uint64_t deadline) {
    for (;;) {
        uint64_t current = now_ns();
        if (!current || current >= deadline) { errno = ETIMEDOUT; return -1; }
        int timeout = (int)((deadline - current + 999999) / 1000000);
        struct pollfd poller = {.fd = fd, .events = POLLIN};
        int result = poll(&poller, 1, timeout);
        if (result < 0 && errno == EINTR) continue;
        if (result <= 0) { if (!result) errno = ETIMEDOUT; return -1; }
        if (poller.revents & POLLNVAL) { errno = EBADF; return -1; }
        if (poller.revents & POLLERR) { errno = EIO; return -1; }
        if (poller.revents & (POLLIN | POLLHUP)) return 0;
    }
}

static int receive(int fd, void *data, size_t size, uint64_t deadline) {
    size_t used = 0;
    while (used < size) {
        if (ready(fd, deadline)) return -1;
        ssize_t count = read(fd, (char *)data + used, size - used);
        if (count < 0 && errno == EINTR) continue;
        if (count <= 0) { if (!count) errno = EPIPE; return -1; }
        used += (size_t)count;
    }
    return 0;
}

static int send_all(int fd, const void *data, size_t size) {
    size_t used = 0;
    while (used < size) {
        ssize_t count = write(fd, (const char *)data + used, size - used);
        if (count < 0 && errno == EINTR) continue;
        if (count <= 0) return -1;
        used += (size_t)count;
    }
    return 0;
}

static int acknowledged(int fd, uint64_t deadline) {
    char permit = 0;
    if (receive(fd, &permit, 1, deadline)) return -1;
    if (permit != 'A') { errno = EPROTO; return -1; }
    return 0;
}

static void child_error(const char *stage) {
    int error = errno;
    dprintf(STDERR_FILENO, "{\"schemaVersion\":\"loredock-direct-birth-native/1\",\"phase\":\"error\",\"stage\":\"%s\",\"errno\":%d}\n", stage, error);
    _exit(125);
}

static void child_run(int target, int report, int acknowledgment, const char *group,
                      pid_t parent, uint64_t deadline, char **command) {
    if (prctl(PR_SET_PDEATHSIG, SIGKILL)) child_error("parent-death-signal");
    if (getppid() != parent) { errno = ECHILD; child_error("parent-lifetime"); }
    if (close(target)) child_error("close-control-descriptor");
    struct birth_record record = {0};
    char placement[READ_BOUND], process[READ_BOUND];
    if (read_small("/proc/self/cgroup", placement, sizeof(placement))) child_error("child-placement-read");
    if (!placement_matches(placement, group)) { errno = EINVAL; child_error("child-placement"); }
    if (read_small("/proc/self/stat", process, sizeof(process))) child_error("child-stat-read");
    if (!start_identity(process, getpid(), &record.start_ticks)) { errno = EINVAL; child_error("child-start-identity"); }
    record.pid = (uint64_t)getpid(); record.uid = getuid(); record.gid = getgid(); record.observed_ns = now_ns();
    if (!record.observed_ns) child_error("child-clock");
    memcpy(record.placement, group, strlen(group) + 1);
    if (send_all(report, &record, sizeof(record)) || close(report)) child_error("birth-report");
    if (acknowledged(acknowledgment, deadline) || close(acknowledgment)) child_error("birth-acknowledgment");
    /* The control parent's stdin is an acknowledgment pipe, never payload input. */
    int input = open("/dev/null", O_RDONLY | O_CLOEXEC);
    if (input < 0 || dup2(input, STDIN_FILENO) < 0 || close(input)) child_error("payload-input");
    if (signal(SIGPIPE, SIG_DFL) == SIG_ERR) child_error("restore-signal");
    char *environment[] = {"PATH=/usr/bin:/bin", "LANG=C.UTF-8", NULL};
    execve("/usr/bin/bwrap", command, environment);
    child_error("sandbox-exec");
}

static bool valid_birth(const struct birth_record *record, pid_t child, const char *group, uint64_t from, uint64_t to) {
    return record->pid == (uint64_t)child && record->start_ticks > 0
        && record->uid == getuid() && record->gid == getgid()
        && record->observed_ns >= from && record->observed_ns <= to
        && memchr(record->placement, '\0', sizeof(record->placement))
        && strcmp(record->placement, group) == 0;
}

static int reap(pid_t child, int *status) {
    pid_t result;
    do { result = waitpid(child, status, 0); } while (result < 0 && errno == EINTR);
    if (result != child) { if (result >= 0) errno = ECHILD; return -1; }
    return 0;
}

int main(int argc, char **argv) {
    uint64_t descriptor, device, inode;
    if (argc < 9 || !decimal(argv[1], &descriptor) || descriptor < 3 || descriptor > INT_MAX
        || !decimal(argv[2], &device) || !decimal(argv[3], &inode) || !inode
        || !related_groups(argv[5], argv[4]) || strcmp(argv[6], "--") || strcmp(argv[7], "/usr/bin/bwrap")) {
        fputs("Usage: native TARGET_FD DEVICE INODE TARGET_CGROUP PARENT_CGROUP -- /usr/bin/bwrap ARGS\n", stderr);
        return 64;
    }
    int target = (int)descriptor;
    struct stat input_info;
    if (fstat(STDIN_FILENO, &input_info) || !S_ISFIFO(input_info.st_mode)) {
        fputs("A collector acknowledgment pipe is required\n", stderr); return 1;
    }
    if (!getuid() || getuid() != geteuid() || !getgid() || getgid() != getegid() || target_identity(target, device, inode)) {
        perror("target identity"); return 1;
    }
    if (fcntl(target, F_SETFD, FD_CLOEXEC) || signal(SIGPIPE, SIG_IGN) == SIG_ERR || signal(SIGCHLD, SIG_DFL) == SIG_ERR) {
        perror("descriptor or signal setup"); return 1;
    }
    char parent_group[READ_BOUND];
    if (read_small("/proc/self/cgroup", parent_group, sizeof(parent_group))) { perror("parent placement read"); return 1; }
    if (!placement_matches(parent_group, argv[5])) {
        fputs("Parent placement mismatch\n", stderr); return 1;
    }
    uint64_t started = now_ns(), deadline = started + NATIVE_WALL_NS;
    if (!started || deadline < started) return 1;
    int report[2], acknowledgment[2];
    if (pipe2(report, O_CLOEXEC)) { perror("birth pipe"); return 1; }
    if (pipe2(acknowledgment, O_CLOEXEC)) { perror("acknowledgment pipe"); close(report[0]); close(report[1]); return 1; }
    int pidfd = -1;
    const char *stage = NULL;
    pid_t parent = getpid(), child = spawn_admitted(target, &pidfd, &stage);
    if (child < 0) {
        int error = errno;
        dprintf(STDERR_FILENO, "{\"schemaVersion\":\"loredock-direct-birth-native/1\",\"phase\":\"error\",\"stage\":\"%s\",\"errno\":%d}\n", stage, error);
        close(report[0]); close(report[1]); close(acknowledgment[0]); close(acknowledgment[1]); close(target);
        return 1;
    }
    if (!child) {
        close(report[0]); close(acknowledgment[1]);
        child_run(target, report[1], acknowledgment[0], argv[4], parent, deadline, &argv[7]);
        _exit(125);
    }
    close(report[1]); close(acknowledgment[0]);
    struct birth_record birth = {0};
    bool failed = false, killed = false, pidfd_ready = false;
    int error = 0, status = 0, pidfd_flags = pidfd < 0 ? -1 : fcntl(pidfd, F_GETFD);
    if (pidfd_flags < 0) { failed = true; error = errno; }
    else if (!(pidfd_flags & FD_CLOEXEC)) { failed = true; error = EINVAL; }
    else if (receive(report[0], &birth, sizeof(birth), deadline)) { failed = true; error = errno; }
    else if (!valid_birth(&birth, child, argv[4], started, now_ns())) { failed = true; error = EINVAL; }
    close(report[0]);
    if (!failed) {
        printf("{\"schemaVersion\":\"loredock-direct-birth-native/1\",\"phase\":\"birth\",\"mechanism\":\"clone3\",\"flags\":\"%" PRIu64 "\",\"pid\":\"%ld\",\"startTimeTicks\":\"%" PRIu64 "\",\"uid\":%u,\"gid\":%u,\"placement\":\"%s\",\"device\":\"%" PRIu64 "\",\"inode\":\"%" PRIu64 "\",\"fromNs\":\"%" PRIu64 "\",\"observedNs\":\"%" PRIu64 "\"}\n",
               (uint64_t)(CLONE_INTO_CGROUP | CLONE_PIDFD), (long)child, birth.start_ticks,
               (unsigned)birth.uid, (unsigned)birth.gid, birth.placement, device, inode, started, birth.observed_ns);
        /* The outside collector fsyncs its independent observation before acknowledging. */
        if (fflush(stdout) || acknowledged(STDIN_FILENO, deadline)
            || send_all(acknowledgment[1], "A", 1)) {
            failed = true; error = errno;
        }
    }
    close(acknowledgment[1]);
    if (!failed && ready(pidfd, deadline) == 0) pidfd_ready = true;
    else if (!failed) { failed = true; error = errno; }
    if (failed) {
        /* An unreaped direct child retains its PID; this cannot target a reused PID. */
        if (kill(child, SIGKILL) == 0) killed = true;
    }
    bool waited = reap(child, &status) == 0;
    bool stable = target_identity(target, device, inode) == 0;
    if (pidfd >= 0) close(pidfd);
    close(target);
    int exit_code = waited && WIFEXITED(status) ? WEXITSTATUS(status) : -1;
    int terminating_signal = waited && WIFSIGNALED(status) ? WTERMSIG(status) : 0;
    printf("{\"schemaVersion\":\"loredock-direct-birth-native/1\",\"phase\":\"exit\",\"pid\":\"%ld\",\"waited\":%s,\"exitCode\":%d,\"signal\":%d,\"pidfdReady\":%s,\"targetStable\":%s,\"forcedKill\":%s,\"collectorError\":%d,\"toNs\":\"%" PRIu64 "\"}\n",
           (long)child, waited ? "true" : "false", exit_code, terminating_signal,
           pidfd_ready ? "true" : "false", stable ? "true" : "false", killed ? "true" : "false", error, now_ns());
    bool published = fflush(stdout) == 0;
    return !failed && waited && stable && pidfd_ready && exit_code == 0 && !terminating_signal && published ? 0 : 1;
}
