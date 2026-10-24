# Build the unsigned Android release APK locally (no EAS).
#   make apk            -> dist/substreamer-<version>-unsigned.apk
#   make apk ARCHS=arm64-v8a   (faster: single ABI)

ANDROID_HOME ?= $(HOME)/.local/share/android-sdk
JAVA_HOME    ?= $(firstword $(wildcard /usr/lib/jvm/java-17-openjdk-amd64 /usr/lib/jvm/java-21-openjdk-amd64))
NDK_VERSION  ?= $(notdir $(lastword $(wildcard $(ANDROID_HOME)/ndk/*)))
BUILD_TOOLS  ?= $(notdir $(lastword $(wildcard $(ANDROID_HOME)/build-tools/*)))
ARCHS        ?= arm64-v8a,armeabi-v7a,x86_64,x86
VERSION      := $(shell node -p "require('./package.json').version" 2>/dev/null)
OUT          := dist/substreamer-$(VERSION)-unsigned.apk
GRADLE_APK   := android/app/build/outputs/apk/release/app-release.apk

export ANDROID_HOME
export ANDROID_SDK_ROOT := $(ANDROID_HOME)
ifneq ($(JAVA_HOME),)
export JAVA_HOME
export PATH := $(JAVA_HOME)/bin:$(PATH)
endif
export EXPO_USE_PRECOMPILED_MODULES ?= 0
export CI ?= 1

.DEFAULT_GOAL := help
.PHONY: help install test test-rnqp prebuild apk adb-install clean distclean

help: ## Show targets
	@grep -E '^[a-zA-Z_-]+:.*## ' $(MAKEFILE_LIST) | awk -F':.*## ' '{printf "  %-10s %s\n", $$1, $$2}'

node_modules/.package-lock.json: package.json package-lock.json
	npm ci
	@touch $@

install: node_modules/.package-lock.json ## Install npm dependencies

test: install ## Run the Jest suite (FILES=path/to/test for a narrow run)
	npx jest $(FILES)

test-rnqp: ## Run react-native-queue-player's Android JVM tests offline (FILTER='pkg.Class*' to narrow)
	scripts/test-rnqp.sh $(FILTER)

prebuild: install ## Generate the native android/ project
	npx expo prebuild --platform android --clean --no-install
	# Expo signs release with the debug keystore; drop that so the APK is unsigned.
	sed -i '115s/signingConfig signingConfigs.debug/\/\/ unsigned: no signingConfig/' android/app/build.gradle
	@sed -n '115p' android/app/build.gradle | grep -q unsigned || { echo "release signingConfig line moved; fix Makefile"; exit 1; }
	printf 'sdk.dir=%s\n' "$(ANDROID_HOME)" > android/local.properties

apk: prebuild ## Build the unsigned release APK into dist/
	cd android && ./gradlew assembleRelease -PreactNativeArchitectures=$(ARCHS) \
		-PndkVersion=$(NDK_VERSION) -PndkOverride=$(NDK_VERSION) -PbuildToolsOverride=$(BUILD_TOOLS) -PbuildToolsVersion=$(BUILD_TOOLS) --init-script ../scripts/ndk-override.init.gradle --no-daemon
	@mkdir -p dist
	@set -e; src=$$(ls android/app/build/outputs/apk/release/*.apk | head -n1); \
	unsigned=$$(ls android/app/build/outputs/apk/release/*unsigned*.apk 2>/dev/null | head -n1); \
	cp "$${unsigned:-$$src}" $(OUT); \
	rm -f dist/.tmp-aligned.apk; \
	"$(ANDROID_HOME)/build-tools/$(BUILD_TOOLS)/apksigner" verify $(OUT) >/dev/null 2>&1 \
		&& echo "NOTE: APK is signed (Expo debug keystore)" || echo "APK is unsigned"; \
	echo "==> $(OUT)"

adb-install: $(OUT) ## Sign a temp copy with the debug key and adb install it (SERIAL=... to pick a device)
	@command -v adb >/dev/null || { echo "adb not found"; exit 1; }
	@ks=android/app/debug.keystore; [ -f $$ks ] || { echo "$$ks missing; run make prebuild"; exit 1; }; \
	"$(ANDROID_HOME)/build-tools/$(BUILD_TOOLS)/apksigner" sign --ks $$ks --ks-pass pass:android \
		--out dist/substreamer-$(VERSION)-debugsigned.apk $(OUT) && \
	adb $(if $(SERIAL),-s $(SERIAL)) install -r dist/substreamer-$(VERSION)-debugsigned.apk

$(OUT):
	$(MAKE) apk

clean: ## Remove generated android/ and dist/
	rm -rf android dist

distclean: clean ## Also remove node_modules
	rm -rf node_modules
