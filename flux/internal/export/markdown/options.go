package markdown

type ExportOptions struct {
	IncludeHeaders   bool
	IncludeBody      bool
	IncludeExamples  bool
	BaseURL          string
	Timestamp        bool
}

func DefaultOptions() ExportOptions {
	return ExportOptions{
		IncludeHeaders:  true,
		IncludeBody:     true,
		IncludeExamples: true,
		Timestamp:       true,
	}
}
