.PHONY: all build chrome firefox source clean

all: build chrome firefox source

build:
	@echo "Building extension..."
	@npm run build:extension

chrome: build
	@echo "Creating Chrome ZIP..."
	@cd dist-chrome && zip -r ../tabtree-chrome.zip . -x "*.DS_Store"
	@echo "✅ tabtree-chrome.zip created"

firefox: build
	@echo "Creating Firefox ZIP..."
	@cd dist-firefox && zip -r ../tabtree-firefox.zip . -x "*.DS_Store"
	@echo "✅ tabtree-firefox.zip created"

source:
	@echo "Creating source code ZIP..."
	@zip -r tabtree-source.zip . -x "node_modules/*" "dist/*" "dist-chrome/*" "dist-firefox/*" "*.DS_Store" "*.zip" ".git/*"
	@echo "✅ tabtree-source.zip created"

clean:
	@echo "Cleaning build artifacts..."
	@rm -rf dist dist-chrome dist-firefox
	@rm -f tabtree-chrome.zip tabtree-firefox.zip tabtree-source.zip
	@echo "✅ Clean complete"
