# Ripes (RISC-V) Tutorial

Thai-language tutorial for the [Ripes](https://github.com/mortbopet/Ripes)
RISC-V simulator. Covers editor, processor view, memory, cache, ecalls, and
peripheral I/O. Used in *1306 220 Computer System and Architecture* at the
Faculty of Engineering, UBU.

Static HTML — open `index.html` in a browser, or serve the folder with any
static-file server.

## Before you start: install Ripes + a RISC-V toolchain

This repo does **not** redistribute the Ripes binary or the RISC-V GNU
toolchain (Ripes is MIT-licensed, the toolchain is GPL — both fine to use
but better to grab fresh from upstream).

1. **Ripes** — download the latest portable build for your OS from the
   [Ripes releases page](https://github.com/mortbopet/Ripes/releases).
2. **RISC-V toolchain** *(optional, only if you want to compile C → RV32IM)*
   — see [the Ripes wiki](https://github.com/mortbopet/Ripes/wiki) for
   the embedded `riscv64-unknown-elf` install.

Once you have Ripes running, work through `index.html` chapter by chapter.

## Live version

The canonical hosted version is on the [Mechatronics Engineering program
website](https://mechatronics-website-655397920844.asia-southeast1.run.app/tutorials).
This repo copy may lag slightly — see the umbrella README.

## Acknowledgements

[Ripes](https://github.com/mortbopet/Ripes) — Morten Borup Petersen et al.,
MIT License. This tutorial is independent and only references Ripes; the
Ripes project is unaffiliated.

## License

Apache 2.0 — see [../LICENSE](../LICENSE).
