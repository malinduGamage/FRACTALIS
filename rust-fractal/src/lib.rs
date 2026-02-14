use wasm_bindgen::prelude::*;
use std::f64::consts::PI;

// ---------------------------------------------------------------------------
// Fractal iteration kernels
// ---------------------------------------------------------------------------

#[inline(always)]
fn iterate_standard(mut z_re: f64, mut z_im: f64, c_re: f64, c_im: f64, max_iter: u32) -> u32 {
    for i in 0..max_iter {
        let r2 = z_re * z_re + z_im * z_im;
        if r2 > 4.0 { return i; }
        let new_re = z_re * z_re - z_im * z_im + c_re;
        let new_im = 2.0 * z_re * z_im + c_im;
        z_re = new_re;
        z_im = new_im;
    }
    max_iter
}

#[inline(always)]
fn iterate_ship(mut z_re: f64, mut z_im: f64, c_re: f64, c_im: f64, max_iter: u32) -> u32 {
    for i in 0..max_iter {
        let r2 = z_re * z_re + z_im * z_im;
        if r2 > 4.0 { return i; }
        let are = z_re.abs();
        let aim = z_im.abs();
        let new_re = are * are - aim * aim + c_re;
        let new_im = 2.0 * are * aim + c_im;
        z_re = new_re;
        z_im = new_im;
    }
    max_iter
}

#[inline(always)]
fn iterate_tricorn(mut z_re: f64, mut z_im: f64, c_re: f64, c_im: f64, max_iter: u32) -> u32 {
    for i in 0..max_iter {
        let r2 = z_re * z_re + z_im * z_im;
        if r2 > 4.0 { return i; }
        let new_re = z_re * z_re - z_im * z_im + c_re;
        let new_im = -2.0 * z_re * z_im + c_im;
        z_re = new_re;
        z_im = new_im;
    }
    max_iter
}

#[inline(always)]
fn iterate_celtic(mut z_re: f64, mut z_im: f64, c_re: f64, c_im: f64, max_iter: u32) -> u32 {
    for i in 0..max_iter {
        let r2 = z_re * z_re + z_im * z_im;
        if r2 > 4.0 { return i; }
        let are = z_re.abs();
        let new_re = are * are - z_im * z_im + c_re;
        let new_im = 2.0 * are * z_im + c_im;
        z_re = new_re;
        z_im = new_im;
    }
    max_iter
}

#[inline(always)]
fn iterate_cosine(mut z_re: f64, mut z_im: f64, c_re: f64, c_im: f64, max_iter: u32) -> u32 {
    for i in 0..max_iter {
        let r2 = z_re * z_re + z_im * z_im;
        if r2 > 100.0 { return i; }
        let new_re = z_re.cos() * z_im.cosh() + c_re;
        let new_im = -(z_re.sin()) * z_im.sinh() + c_im;
        z_re = new_re;
        z_im = new_im;
    }
    max_iter
}

// ---------------------------------------------------------------------------
// Color helpers
// ---------------------------------------------------------------------------

fn hex_to_rgb(hex: &str) -> (u8, u8, u8) {
    let h = hex.trim_start_matches('#');
    let v = u32::from_str_radix(h, 16).unwrap_or(0);
    (((v >> 16) & 0xFF) as u8, ((v >> 8) & 0xFF) as u8, (v & 0xFF) as u8)
}

fn lerp_color(c1: (u8, u8, u8), c2: (u8, u8, u8), t: f64) -> (u8, u8, u8) {
    (
        ((1.0 - t) * c1.0 as f64 + t * c2.0 as f64) as u8,
        ((1.0 - t) * c1.1 as f64 + t * c2.1 as f64) as u8,
        ((1.0 - t) * c1.2 as f64 + t * c2.2 as f64) as u8,
    )
}

fn build_gradient_lut(colors: &[(u8, u8, u8)], steps: usize) -> Vec<(u8, u8, u8)> {
    let mut lut = vec![(0u8, 0u8, 0u8); steps];
    if colors.len() < 2 { return lut; }
    let n = colors.len() - 1;
    let sps = steps / n;
    for i in 0..n {
        let s = i * sps;
        let e = if i < n - 1 { (i + 1) * sps } else { steps };
        let seg = e - s;
        for j in 0..seg {
            let t = if seg > 1 { j as f64 / (seg - 1) as f64 } else { 0.0 };
            lut[s + j] = lerp_color(colors[i], colors[i + 1], t);
        }
    }
    lut
}

// ---------------------------------------------------------------------------
// Main render — exported to JavaScript
// ---------------------------------------------------------------------------

/// Renders a Julia Set fractal and returns an RGBA pixel buffer.
///
/// `colors_flat` is 15 bytes: 5 colors × 3 channels (R, G, B) packed sequentially.
/// `fractal_type`: 0=standard, 1=ship, 2=tricorn, 3=celtic, 4=cosine
#[wasm_bindgen]
pub fn render(
    width: u32,
    height: u32,
    c_re: f64,
    c_im: f64,
    zoom: f64,
    x_off: f64,
    y_off: f64,
    rotation_deg: f64,
    max_iter: u32,
    fractal_type: u32,
    colors_flat: &[u8],  // 15 bytes: 5 colors × RGB
    bg_r: u8,
    bg_g: u8,
    bg_b: u8,
    fade_black: f64,
    alpha_gamma: f64,
    transparent: bool,
) -> Vec<u8> {
    let w = width as usize;
    let h = height as usize;

    // Parse gradient colors
    let mut grad_colors: Vec<(u8, u8, u8)> = Vec::with_capacity(5);
    for i in 0..5 {
        let off = i * 3;
        if off + 2 < colors_flat.len() {
            grad_colors.push((colors_flat[off], colors_flat[off + 1], colors_flat[off + 2]));
        }
    }
    let lut = build_gradient_lut(&grad_colors, 1024);

    // Coordinate bounds
    let aspect = w as f64 / h as f64;
    let x_range = 3.0 * aspect / zoom;
    let y_range = 3.0 / zoom;
    let min_x = x_off - x_range / 2.0;
    let max_x = x_off + x_range / 2.0;
    let min_y = y_off - y_range / 2.0;
    let max_y = y_off + y_range / 2.0;

    // Rotation
    let rad = rotation_deg * PI / 180.0;
    let cos_t = rad.cos();
    let sin_t = rad.sin();
    let cx = (min_x + max_x) / 2.0;
    let cy = (min_y + max_y) / 2.0;

    // Select iteration function
    let iterate: fn(f64, f64, f64, f64, u32) -> u32 = match fractal_type {
        1 => iterate_ship,
        2 => iterate_tricorn,
        3 => iterate_celtic,
        4 => iterate_cosine,
        _ => iterate_standard,
    };

    // Allocate output
    let mut rgba = vec![0u8; w * h * 4];

    for y in 0..h {
        let imag_base = min_y + (y as f64 / h as f64) * (max_y - min_y);
        for x in 0..w {
            let real_base = min_x + (x as f64 / w as f64) * (max_x - min_x);

            // Apply rotation
            let dx = real_base - cx;
            let dy = imag_base - cy;
            let z_re = dx * cos_t - dy * sin_t + cx;
            let z_im = dx * sin_t + dy * cos_t + cy;

            let iter = iterate(z_re, z_im, c_re, c_im, max_iter);

            // Color mapping using LUT
            let lut_idx = ((iter as usize).wrapping_mul(10)) % 1024;
            let (r, g, b) = lut[lut_idx];

            // Alpha from brightness
            let brightness = r.max(g).max(b) as f64;
            let alpha_norm = if fade_black >= 255.0 {
                0.0
            } else {
                ((brightness - fade_black) / (255.0 - fade_black)).clamp(0.0, 1.0)
            };
            let alpha = (alpha_norm.powf(alpha_gamma) * 255.0) as u8;

            let idx = (y * w + x) * 4;

            if transparent {
                let a = if iter >= max_iter { 0 } else { alpha };
                rgba[idx]     = r;
                rgba[idx + 1] = g;
                rgba[idx + 2] = b;
                rgba[idx + 3] = a;
            } else {
                // Composite over background
                let a_f = if iter >= max_iter { 0.0 } else { alpha as f64 / 255.0 };
                rgba[idx]     = (r as f64 * a_f + bg_r as f64 * (1.0 - a_f)) as u8;
                rgba[idx + 1] = (g as f64 * a_f + bg_g as f64 * (1.0 - a_f)) as u8;
                rgba[idx + 2] = (b as f64 * a_f + bg_b as f64 * (1.0 - a_f)) as u8;
                rgba[idx + 3] = 255;
            }
        }
    }

    rgba
}
