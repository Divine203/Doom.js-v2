// const sector1 = new Sector(0, 130, []); // Normal room
// const sector2 = new Sector(-10, 100, []); // Raised platform
// const sector3 = new Sector(-20, 200, []); // Raised platform

// const l1 = new Line(20, 15, 30, 5);
// const l2 = new Line(30, 5, 50, 5);
// const l3 = new Line(50, 5, 60, 15);
// const l4 = new Line(60, 15, 55, 30);
// const l5 = new Line(55, 30, 30, 30, true, sector2);
// const l6 = new Line(30, 30, 20, 15);

// sector1.walls = [l1, l2, l3, l4, l5, l6];

// const l5b = new Line(30, 30, 55, 30, true, sector1);
// const l7 = new Line(55, 30, 65, 40);
// const l8 = new Line(65, 40, 60, 55);
// const l9 = new Line(60, 55, 30, 55, true, sector3);
// const l10 = new Line(30, 55, 20, 45);
// const l11 = new Line(20, 45, 30, 30); // Connects back to the start of l5b

// sector2.walls = [l5b, l7, l8, l9, l10, l11];

// const l9b = new Line(60, 55, 30, 55, true, sector2); // top line
// const l12 = new Line(60, 55, 70, 75); // right line
// const l13 = new Line(70, 75, 60, 85); // right line
// const l14 = new Line(60, 85, 30, 85); // bottom line
// const l15 = new Line(30, 85, 20, 75); // left line
// const l16 = new Line(20, 75, 30, 55); // left line

// sector3.walls = [l9b, l12, l13, l14, l15, l16];

// const map = [
//     l1, l2, l3, l4, l5, l6,
//     l5b, l7, l8, l9, l10, l11,
//     l9b, l12, l13, l14, l15, l16
// ];



    //  drawTexturedWallOld(x1, y1Top, y1Bottom, x2, y2Top, y2Bottom, texture, ry1, ry2, isPortal = false) {
    //     if (!texture) return;

    //     if (x2 < x1) {
    //         [x1, x2] = [x2, x1];
    //         [y1Top, y2Top] = [y2Top, y1Top];
    //         [y1Bottom, y2Bottom] = [y2Bottom, y1Bottom];
    //         [ry1, ry2] = [ry2, ry1];
    //     }

    //     const dx = x2 - x1;
    //     if (dx <= 0) return;

    //     const iz1 = 1 / ry1;
    //     const iz2 = 1 / ry2;
    //     const u1 = 0 * iz1;
    //     const u2 = texture.width * iz2;

    //     for (let x = x1; x <= x2; x++) {
    //         const t = (x - x1) / dx;
    //         const currentIZ = iz1 + (iz2 - iz1) * t;
    //         const currentUZ = u1 + (u2 - u1) * t;
    //         const texX = (currentUZ / currentIZ) | 0;
    //         // const wrappedTexX = Math.abs(texX % texture.width);
    //         let wrappedTexX = texX;
    //         if (wrappedTexX >= texture.width) wrappedTexX -= texture.width;

    //         const top = y1Top + (y2Top - y1Top) * t;
    //         const bottom = y1Bottom + (y2Bottom - y1Bottom) * t;
    //         const depth = ry1 + t * (ry2 - ry1);

    //         if (bottom <= top) continue;

    //         // Only skip for opaque walls
    //         if (!isPortal && depth >= zBuffer[x]) continue;
    //         if (!isPortal) zBuffer[x] = depth;

    //         const colHeight = bottom - top;
    //         const vStep = texture.height / colHeight;
    //         let v = 0;

    //         const ry = 1 / currentIZ;
    //         const shade = 255 - ry * 0.15;

    //         for (let y = Math.floor(top); y < Math.ceil(bottom); y++) {
    //             // const texY = (v | 0) % texture.height;
    //             let texY = v | 0;
    //             if (texY >= texture.height) texY -= texture.height;

    //             const i = (texY * texture.width + wrappedTexX) * 4;

    //             if (!(isPortal && depth >= zBuffer[x])) {
    //                 putPixelZ(
    //                     x, y, depth,
    //                     (texture.data[i] * shade) >> 8,
    //                     (texture.data[i + 1] * shade) >> 8,
    //                     (texture.data[i + 2] * shade) >> 8
    //                 );
    //             }
    //             v += vStep;
    //         }
    //     }
    // }


    // function putPixelZ(x, y, z, r, g, b) {
//     if (x < 0 || x >= W || y < 0 || y >= H) return;
//     const idx = y * W + x;
//     if (z >= project3D.zBuffer[idx]) return;
//     project3D.zBuffer[idx] = z;

//     // --- FOG CALCULATION ---
//     const maxDist = 700; // Anything beyond this is pitch black
//     const minDist = 50;  // Anything closer than this is full brightness

//     // Calculate shade: 1.0 (close) to 0.0 (far)
//     let shade = (maxDist - z) / (maxDist - minDist);

//     // Clamp shade between 0 and 1
//     if (shade < 0) shade = 0;
//     if (shade > 1) shade = 1;

//     // Apply shade to colors
//     const i = idx * 4;
//     pixels[i] = r * shade;
//     pixels[i + 1] = g * shade;
//     pixels[i + 2] = b * shade;
//     pixels[i + 3] = 255;
// }


