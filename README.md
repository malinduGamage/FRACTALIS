# FRACTALIS — Digital Art Studio

**FRACTALIS** is a high-performance, interactive Julia Set fractal explorer built with **Rust (WebAssembly)** and **JavaScript**. It allows users to create, explore, and export infinite-resolution mathematical art directly in the browser.

[**Live Demo**](https://malindugamage.github.io/FRACTALIS/)

## Features

- **High-Performance Engine**: Powered by Rust + WASM for real-time rendering of complex fractals.
- **Multiple Fractal Types**:
  - Standard Julia
  - Burning Ship
  - Tricorn
  - Celtic
  - Cosine
- **Interactive Controls**:
  - Fine-tune Complex Number constants ($Re$, $Im$)
  - Real-time Zoom, Pan, and Rotation
  - Adjustable Iteration Depth (internal)
- **Advanced Styling**:
  - Custom Color Gradients (5-stop editor)
  - Background Transparency & Color selection
  - Light / Midnight UI Themes
- **Studio Export**:
  - Render high-resolution images (up to 4K and beyond)
  - Support for PNG, JPEG, and WebP formats
  - Drag-and-drop sized canvas

## Tech Stack

- **Frontend**: HTML5, CSS3, Vanilla JavaScript (ES6+)
- **Core Engine**: Rust (with `wasm-bindgen`)
- **Build Tool**: `wasm-pack`

## Getting Started

### Prerequisites

To run this project locally, you need a web server because modern browsers restrict loading WASM files from the `file://` protocol.

### Running Locally

1.  **Clone the repository**:

    ```bash
    git clone https://github.com/your-username/fractalis.git
    cd fractalis
    ```

2.  **Serve the directory**:
    You can use any static file server. For example:

    _Using Node.js (http-server):_

    ```bash
    npx http-server .
    ```

3.  **Open in Browser**:
    Navigate to `http://localhost:8000` (or the port shown in your terminal).

### Rebuilding the WASM Engine

If you modify the Rust code in `rust-fractal/src`, you need to rebuild the WebAssembly package:

1.  **Install Rust & wasm-pack**:
    - [Install Rust](https://www.rust-lang.org/tools/install)
    - [Install wasm-pack](https://rustwasm.github.io/wasm-pack/installer/)

2.  **Build**:
    ```bash
    cd rust-fractal
    wasm-pack build --target web
    ```

## Project Structure

```
├── index.html          # Landing page
├── tool.html           # Main application (Studio)
├── app.js              # UI Logic & WASM Bridge
├── style.css           # Global Styles & Theme Variables
├── rust-fractal/       # Rust Source Code
│   ├── src/lib.rs      # Fractal Calculation Logic
│   └── pkg/            # Compiled WASM artifacts
└── img/                # Assets
```
