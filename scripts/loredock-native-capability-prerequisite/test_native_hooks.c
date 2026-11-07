/* Keep wrappers in a separate translation unit: compiler analysis cannot see linker rewrites. */
#define _GNU_SOURCE
#include "test_native_hooks.h"
#include <assert.h>
#include <errno.h>
#include <linux/magic.h>
#include <linux/sched.h>
#include <signal.h>
#include <stdarg.h>
#include <stdint.h>
#include <string.h>
#include <sys/prctl.h>
#include <sys/statfs.h>
#include <sys/syscall.h>

int syscall_calls, injected_errno, injected_fs, wait_mode, wait_calls;
pid_t injected_pid = 321;
struct __user_cap_data_struct fake_caps[2];
int capset_calls, capget_calls, nnp_calls, capset_error, capget_error, set_result, get_result;
int nnp_before = 1, nnp_after = 1, remaining_field = -1, changed_header, partial_read;
char trace[128];

static void record_call(char value) {
    size_t used = strlen(trace);
    assert(used + 1 < sizeof(trace));
    trace[used] = value;
    trace[used + 1] = '\0';
}

int __wrap_prctl(int option, ...) {
    assert(option == PR_GET_NO_NEW_PRIVS);
    va_list arguments;
    va_start(arguments, option);
    for (int i = 0; i < 4; i++) assert(va_arg(arguments, unsigned long) == 0);
    va_end(arguments);
    record_call('N');
    int result = nnp_calls++ ? nnp_after : nnp_before;
    if (result < 0) errno = EIO;
    return result;
}

long __wrap_syscall(long number, ...) {
    va_list values;
    va_start(values, number);
    if (number == SYS_capset || number == SYS_capget) {
        struct __user_cap_header_struct *header = va_arg(values, struct __user_cap_header_struct *);
        struct __user_cap_data_struct *data = va_arg(values, struct __user_cap_data_struct *);
        va_end(values);
        assert(header->version == _LINUX_CAPABILITY_VERSION_3 && header->pid == 0);
        if (number == SYS_capset) {
            record_call('S');
            capset_calls++;
            for (size_t i = 0; i < 2; i++)
                assert(!data[i].effective && !data[i].permitted && !data[i].inheritable);
            if (capset_error) { errno = capset_error; return -1; }
            if (set_result) return set_result;
            memcpy(fake_caps, data, sizeof(fake_caps));
        } else {
            record_call('G');
            capget_calls++;
            if (capget_error) { errno = capget_error; return -1; }
            if (get_result) return get_result;
            memcpy(data, fake_caps, partial_read ? sizeof(*data) : sizeof(fake_caps));
            if (changed_header == 1) header->version = _LINUX_CAPABILITY_VERSION_1;
            if (changed_header == 2) header->pid = 321;
            if (remaining_field >= 0) {
                int word = remaining_field / 3, field = remaining_field % 3;
                if (field == 0) data[word].effective = 8;
                if (field == 1) data[word].permitted = 8;
                if (field == 2) data[word].inheritable = 8;
            }
        }
        return 0;
    }
    assert(number == SYS_clone3);
    record_call('C');
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
