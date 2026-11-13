package trust

import "regexp"

// placeholderPattern matches a {{VARIABLE}} reference. The receipt records the
// request before substitution, so placeholders are expected to survive.
var placeholderPattern = regexp.MustCompile(`\{\{\s*([\w.-]+)\s*\}\}`)

// placeholders returns the variable names referenced in text.
func placeholders(text string) []string {
	matches := placeholderPattern.FindAllStringSubmatch(text, -1)
	out := make([]string, 0, len(matches))
	for _, m := range matches {
		out = append(out, m[1])
	}
	return out
}
