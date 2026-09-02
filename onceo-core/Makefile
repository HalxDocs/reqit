.PHONY: test lint fuzz build example clean coverage

test:
	go test ./... -race -cover -count=1 -timeout=60s

lint:
	golangci-lint run

fuzz:
	go test -fuzz=FuzzParse -fuzztime=30s ./providers/...

build:
	go build -o onceo ./cmd/onceo

coverage:
	go test ./... -coverprofile=coverage.out -count=1 -timeout=60s
	go tool cover -func=coverage.out
	go tool cover -html=coverage.out -o coverage.html

example:
	go run ./examples/basic

clean:
	rm -f onceo
	rm -rf dist/ coverage.out coverage.html
