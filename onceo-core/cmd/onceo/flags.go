package main

import "strings"

// reorderArgs moves positional (non-flag) arguments after all flags so that
// flag.Parse sees flags first and stops at the trailing file argument. This
// makes both `onceo verify <file> --provider ...` and flags-first
// invocations work. valueFlags lists the flags that consume the next
// argument as their value (e.g. --secret noop).
func reorderArgs(args []string, valueFlags ...string) []string {
	valueSet := make(map[string]bool, len(valueFlags))
	for _, f := range valueFlags {
		valueSet[f] = true
	}

	var flags, positional []string
	for i := 0; i < len(args); i++ {
		a := args[i]
		if a == "--" {
			// Preserve the standard flag terminator: everything after it is
			// positional, and flag.Parse stops there.
			flags = append(flags, a)
			positional = append(positional, args[i+1:]...)
			break
		}
		if len(a) > 1 && a[0] == '-' {
			name := strings.TrimLeft(strings.SplitN(a, "=", 2)[0], "-")
			flags = append(flags, a)
			if _, ok := valueSet[name]; ok && !strings.Contains(a, "=") && i+1 < len(args) {
				flags = append(flags, args[i+1])
				i++
			}
			continue
		}
		positional = append(positional, a)
	}
	return append(flags, positional...)
}
