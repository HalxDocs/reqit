package main

import (
	"flag"
	"fmt"
	"os"
)

func main() {
	if err := run(); err != nil {
		fmt.Fprintf(os.Stderr, "error: %v\n", err)
		os.Exit(1)
	}
}

func run() error {
	flag.Usage = func() {
		fmt.Fprintf(os.Stderr, `onceo - one clean payment event, every rail, exactly once.

Usage:
  onceo verify <file> --provider <provider> [--secret <secret>]
  onceo replay <file> --url <url> [--secret <secret>]
  onceo help

Commands:
  verify   Validate a webhook payload signature and print normalised event
  replay   Re-send a captured payload to a local test server
  help     Show this help

Flags:
  --provider   Provider name: paystack, flutterwave, opay, mpesa, svix, bachs
  --secret     Provider secret key / hash
  --url        Target URL for replay
`)
	}

	if len(os.Args) < 2 {
		flag.Usage()
		return nil
	}

	switch os.Args[1] {
	case "verify":
		return verifyCmd(os.Args[2:])
	case "replay":
		return replayCmd(os.Args[2:])
	case "help", "--help", "-h":
		flag.Usage()
		return nil
	default:
		return fmt.Errorf("unknown command: %s", os.Args[1])
	}
}
