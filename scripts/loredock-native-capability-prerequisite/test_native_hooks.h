/* Shared test state has external linkage across the linker-wrap boundary. */
#ifndef LOREDOCK_CAPABILITY_TEST_HOOKS_H
#define LOREDOCK_CAPABILITY_TEST_HOOKS_H
#include <linux/capability.h>
#include <sys/types.h>
extern int syscall_calls, injected_errno, injected_fs, wait_mode, wait_calls;
extern pid_t injected_pid;
extern struct __user_cap_data_struct fake_caps[2];
extern int capset_calls, capget_calls, nnp_calls, capset_error, capget_error, set_result, get_result;
extern int nnp_before, nnp_after, remaining_field, changed_header, partial_read;
extern char trace[128];
#endif
