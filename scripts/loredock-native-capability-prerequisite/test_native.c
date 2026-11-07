/* Capability, prctl, clone3 and waitpid operations are intercepted, never executed. */
#define main native_main
#include "native.c"
#undef main
#include <assert.h>

#include "test_native_hooks.h"

static int capability_cases;

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

static void reset_capabilities(void) {
    memset(fake_caps, 0, sizeof(fake_caps));
    memset(trace, 0, sizeof(trace));
    syscall_calls = injected_errno = capset_calls = capget_calls = nnp_calls = 0;
    capset_error = capget_error = set_result = get_result = changed_header = partial_read = 0;
    remaining_field = -1;
    nnp_before = nnp_after = 1;
}

static void expect_denial(const char *expected_stage, int expected_errno, const char *expected_trace) {
    int pidfd = -1;
    const char *stage = NULL;
    assert(spawn_admitted(17, &pidfd, &stage) == -1);
    assert(errno == expected_errno && !strcmp(stage, expected_stage));
    assert(!strcmp(trace, expected_trace) && syscall_calls == 0 && pidfd == -1);
    assert(capset_calls <= 1 && capget_calls <= 1);
    capability_cases++;
}

static void capability_admission(void) {
    for (int inherited = 0; inherited <= 2; inherited++) {
        reset_capabilities();
        /* The retained 0000000800000000 mask is word 1, bit 3. No real rights are set. */
        fake_caps[1].inheritable = inherited ? 8 : 0;
        if (inherited == 2) memset(fake_caps, 0xff, sizeof(fake_caps));
        int pidfd = -1;
        const char *stage = NULL;
        assert(spawn_admitted(17, &pidfd, &stage) == 321 && pidfd == 42);
        assert(!strcmp(stage, "clone3") && !strcmp(trace, "NSGNC"));
        assert(!fake_caps[1].inheritable && capset_calls == 1 && capget_calls == 1 && syscall_calls == 1);
        capability_cases++;
    }
    const int before_values[] = {0, -1, 2};
    for (size_t i = 0; i < sizeof(before_values) / sizeof(*before_values); i++) {
        reset_capabilities();
        nnp_before = before_values[i];
        expect_denial("no-new-privileges-before", nnp_before < 0 ? EIO : EPERM, "N");
    }
    const int after_values[] = {-1, 0, 2};
    for (size_t i = 0; i < sizeof(after_values) / sizeof(*after_values); i++) {
        reset_capabilities();
        nnp_after = after_values[i];
        expect_denial("no-new-privileges-after", nnp_after < 0 ? EIO : EPERM, "NSGN");
    }
    const int set_errors[] = {EPERM, EINVAL, EIO};
    for (size_t i = 0; i < sizeof(set_errors) / sizeof(*set_errors); i++) {
        reset_capabilities();
        capset_error = set_errors[i];
        expect_denial("capset", capset_error, "NS");
    }
    const int get_errors[] = {EIO, EINVAL};
    for (size_t i = 0; i < sizeof(get_errors) / sizeof(*get_errors); i++) {
        reset_capabilities();
        capget_error = get_errors[i];
        expect_denial("capget", capget_error, "NSG");
    }
    reset_capabilities();
    set_result = 1;
    expect_denial("capset", EPROTO, "NS");
    reset_capabilities();
    get_result = 1;
    expect_denial("capget", EPROTO, "NSG");
    reset_capabilities();
    changed_header = 1;
    expect_denial("capability-readback", EPROTO, "NSG");
    reset_capabilities();
    changed_header = 2;
    expect_denial("capability-readback", EPROTO, "NSG");
    reset_capabilities();
    partial_read = 1;
    expect_denial("capability-readback", EPERM, "NSG");
    for (int field = 0; field < 6; field++) {
        reset_capabilities();
        remaining_field = field;
        expect_denial("capability-readback", EPERM, "NSG");
    }
    reset_capabilities();
    injected_errno = ENOSYS;
    int pidfd = -1;
    const char *stage = NULL;
    assert(spawn_admitted(17, &pidfd, &stage) == -1 && errno == ENOSYS && pidfd == -1);
    assert(!strcmp(stage, "clone3") && !strcmp(trace, "NSGNC") && syscall_calls == 1);
    capability_cases++;
    assert(capability_cases == 26);
    printf("Capability boundary cases passed: %d; all privilege and creation calls were intercepted.\n", capability_cases);
}

int main(int argc, char **argv) {
    assert(argc == 2);
    numbers_and_paths();
    process_identity();
    target_and_reads(argv[1]);
    pipes_and_deadlines();
    intercepted_creation_and_wait();
    assert(syscall_calls == 5);
    capability_admission();
    puts("Native boundary checks passed; capability, prctl, clone3 and waitpid calls were intercepted.");
    return 0;
}
