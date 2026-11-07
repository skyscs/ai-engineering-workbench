/* The linker intercepts every explicit syscall and waitpid call from native.c. */
#define main native_main
#include "native.c"
#undef main
#include <assert.h>
#include <stdarg.h>

static int syscall_calls, injected_errno, injected_fs, wait_mode, wait_calls;
static pid_t injected_pid = 321;

long __wrap_syscall(long number, ...) {
    assert(number == SYS_clone3);
    va_list values;
    va_start(values, number);
    struct clone_args *args = va_arg(values, struct clone_args *);
    size_t size = va_arg(values, size_t);
    va_end(values);
    assert(size == CLONE_ARGS_SIZE_VER2);
    assert(args->flags == (CLONE_INTO_CGROUP | CLONE_PIDFD));
    assert(args->cgroup == 17 && args->exit_signal == SIGCHLD && args->pidfd);
    assert(!args->child_tid && !args->parent_tid && !args->stack && !args->stack_size);
    assert(!args->tls && !args->set_tid && !args->set_tid_size);
    syscall_calls++;
    if (injected_errno) { errno = injected_errno; return -1; }
    *(int *)(uintptr_t)args->pidfd = 42;
    return injected_pid;
}

int __real_fstatfs(int, struct statfs *);
int __wrap_fstatfs(int fd, struct statfs *result) {
    if (!injected_fs) return __real_fstatfs(fd, result);
    memset(result, 0, sizeof(*result));
    result->f_type = injected_fs == 1 ? CGROUP2_SUPER_MAGIC : 123;
    return 0;
}

pid_t __wrap_waitpid(pid_t child, int *status, int options) {
    assert(child == 321 && options == 0);
    wait_calls++;
    if (wait_mode == 1 && wait_calls == 1) { errno = EINTR; return -1; }
    if (wait_mode == 2) { errno = ECHILD; return -1; }
    *status = 0;
    return wait_mode == 3 ? 322 : child;
}

static void numbers_and_paths(void) {
    uint64_t value;
    assert(decimal("0", &value) && value == 0);
    assert(decimal("18446744073709551615", &value) && value == UINT64_MAX);
    const char *invalid[] = {"", "-1", "+1", "01", "1 ", "1x", "18446744073709551616", "999999999999999999999999999"};
    for (size_t i = 0; i < sizeof(invalid) / sizeof(*invalid); i++) assert(!decimal(invalid[i], &value));
    assert(related_groups("/owned/attestor", "/owned/run/probe"));
    assert(!related_groups("/terminal", "/owned/run/probe"));
    assert(!related_groups("/owned/attestor", "/other/run/probe"));
    assert(!related_groups("/owned/attestor", "/owned/run/probe/child"));
    assert(!safe_group("/owned/../escape") && !safe_group("/owned//leaf"));
    assert(!safe_group("/owned/\"leaf") && !safe_group("/owned/\nleaf"));
    assert(placement_matches("0::/owned/run/probe\n", "/owned/run/probe"));
    assert(!placement_matches("0::/owned/run/probe\n0::/other\n", "/owned/run/probe"));
    assert(!placement_matches("0::/owned/run/probe", "/owned/run/probe"));
}

static void process_identity(void) {
    char original[512] = "321 (nested (process)) S ";
    for (int field = 4; field <= 21; field++) strcat(original, "0 ");
    strcat(original, "456 0\n");
    char raw[512];
    uint64_t start;
    strcpy(raw, original);
    assert(start_identity(raw, 321, &start) && start == 456);
    strcpy(raw, original);
    assert(!start_identity(raw, 322, &start));
    strcpy(raw, "321 broken");
    assert(!start_identity(raw, 321, &start));
    strcpy(raw, "321 (name) S 0");
    assert(!start_identity(raw, 321, &start));
    struct birth_record birth = {.pid = 321, .start_ticks = 456, .uid = getuid(), .gid = getgid(), .observed_ns = 200};
    strcpy(birth.placement, "/owned/run/probe");
    assert(valid_birth(&birth, 321, "/owned/run/probe", 100, 300));
    assert(!valid_birth(&birth, 322, "/owned/run/probe", 100, 300));
    assert(!valid_birth(&birth, 321, "/other", 100, 300));
    assert(!valid_birth(&birth, 321, "/owned/run/probe", 201, 300));
    assert(!valid_birth(&birth, 321, "/owned/run/probe", 100, 199));
    birth.uid++;
    assert(!valid_birth(&birth, 321, "/owned/run/probe", 100, 300));
    birth.uid = getuid();
    memset(birth.placement, 'x', sizeof(birth.placement));
    assert(!valid_birth(&birth, 321, "/owned/run/probe", 100, 300));
}

static void target_and_reads(const char *directory) {
    int fd = open(directory, O_RDONLY | O_DIRECTORY | O_CLOEXEC);
    assert(fd >= 3);
    struct stat info;
    assert(fstat(fd, &info) == 0);
    injected_fs = 1;
    assert(target_identity(fd, info.st_dev, info.st_ino) == 0);
    assert(target_identity(fd, info.st_dev, info.st_ino + 1) == -1 && errno == EINVAL);
    assert(target_identity(fd, info.st_dev + 1, info.st_ino) == -1 && errno == EINVAL);
    injected_fs = 2;
    assert(target_identity(fd, info.st_dev, info.st_ino) == -1 && errno == EINVAL);
    injected_fs = 0;
    close(fd);
    char path[PATH_BOUND], link[PATH_BOUND], bytes[16];
    assert(snprintf(path, sizeof(path), "%s/input", directory) > 0);
    assert(snprintf(link, sizeof(link), "%s/link", directory) > 0);
    fd = open(path, O_WRONLY | O_CREAT | O_EXCL | O_CLOEXEC, 0600);
    assert(fd >= 3 && send_all(fd, "12345678", 8) == 0 && close(fd) == 0);
    fd = open(path, O_RDONLY | O_CLOEXEC);
    assert(fd >= 3 && fstat(fd, &info) == 0);
    injected_fs = 1;
    assert(target_identity(fd, info.st_dev, info.st_ino) == -1 && errno == EINVAL);
    injected_fs = 0;
    assert(close(fd) == 0);
    assert(read_small(path, bytes, 9) == 0 && !strcmp(bytes, "12345678"));
    assert(read_small(path, bytes, 8) == -1 && errno == EOVERFLOW);
    assert(read_small(path, bytes, 0) == -1 && errno == EINVAL);
    assert(symlink(path, link) == 0);
    assert(read_small(link, bytes, sizeof(bytes)) == -1 && errno == ELOOP);
    assert(unlink(link) == 0 && unlink(path) == 0);
}

static void pipes_and_deadlines(void) {
    int fds[2];
    assert(pipe2(fds, O_CLOEXEC) == 0);
    assert(send_all(fds[1], "A", 1) == 0);
    assert(acknowledged(fds[0], now_ns() + 100000000) == 0);
    assert(send_all(fds[1], "X", 1) == 0);
    assert(acknowledged(fds[0], now_ns() + 100000000) == -1 && errno == EPROTO);
    assert(ready(fds[0], now_ns() - 1) == -1 && errno == ETIMEDOUT);
    assert(close(fds[1]) == 0);
    char value;
    assert(receive(fds[0], &value, 1, now_ns() + 100000000) == -1 && errno == EPIPE);
    assert(close(fds[0]) == 0);
    assert(ready(fds[0], now_ns() + 100000000) == -1 && errno == EBADF);
}

static void intercepted_creation_and_wait(void) {
    const int errors[] = {ENOSYS, EACCES, EBUSY, EOPNOTSUPP};
    for (size_t i = 0; i < sizeof(errors) / sizeof(*errors); i++) {
        int pidfd = -1;
        injected_errno = errors[i];
        assert(spawn_direct(17, &pidfd) == -1 && errno == errors[i] && pidfd == -1);
    }
    injected_errno = 0;
    int pidfd = -1;
    assert(spawn_direct(17, &pidfd) == 321 && pidfd == 42);
    assert(syscall_calls == 5);
    int status;
    for (int mode = 0; mode <= 3; mode++) {
        wait_mode = mode; wait_calls = 0;
        if (mode < 2) assert(reap(321, &status) == 0 && status == 0);
        else assert(reap(321, &status) == -1 && errno == ECHILD);
        if (mode == 1) assert(wait_calls == 2);
    }
}

int main(int argc, char **argv) {
    assert(argc == 2);
    numbers_and_paths();
    process_identity();
    target_and_reads(argv[1]);
    pipes_and_deadlines();
    intercepted_creation_and_wait();
    assert(syscall_calls == 5);
    puts("Native boundary checks passed; all clone3 and waitpid calls were intercepted.");
    return 0;
}
