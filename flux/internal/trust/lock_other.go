//go:build !windows && !(darwin || dragonfly || freebsd || illumos || linux || netbsd || openbsd)

package trust

import (
	"errors"
	"fmt"
	"os"
	"time"
)

// lockPath is the fallback for platforms without a supported advisory lock.
// It creates a lock file exclusively and retries, removing a lock left behind
// by a crashed writer.
func lockPath(path string) (func(), error) {
	deadline := time.Now().Add(5 * time.Second)
	for {
		f, err := os.OpenFile(path, os.O_CREATE|os.O_EXCL|os.O_WRONLY, 0o600)
		if err == nil {
			fmt.Fprintf(f, "%d\n", os.Getpid())
			_ = f.Close()
			return func() { _ = os.Remove(path) }, nil
		}
		if !errors.Is(err, os.ErrExist) {
			return nil, err
		}
		if info, statErr := os.Stat(path); statErr == nil && time.Since(info.ModTime()) > 30*time.Second {
			_ = os.Remove(path)
			continue
		}
		if time.Now().After(deadline) {
			return nil, errors.New("receipt store is busy")
		}
		time.Sleep(2 * time.Millisecond)
	}
}
