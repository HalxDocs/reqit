//go:build darwin || dragonfly || freebsd || illumos || linux || netbsd || openbsd

package trust

import (
	"os"
	"syscall"
)

// lockPath takes an exclusive advisory lock on path. The lock belongs to the
// open file, so the kernel releases it if the process dies — there is no stale
// lock to break. The file is left in place; it is not a receipt.
func lockPath(path string) (func(), error) {
	f, err := os.OpenFile(path, os.O_CREATE|os.O_RDWR, 0o600)
	if err != nil {
		return nil, err
	}
	if err := syscall.Flock(int(f.Fd()), syscall.LOCK_EX); err != nil {
		_ = f.Close()
		return nil, err
	}
	return func() {
		_ = syscall.Flock(int(f.Fd()), syscall.LOCK_UN)
		_ = f.Close()
	}, nil
}
