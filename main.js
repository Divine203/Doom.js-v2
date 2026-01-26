const c = document.querySelector('#c');
const ctx = c.getContext('2d');

const K = {
    r: false, l: false,
    u: false, d: false,

    W: false, A: false,
    S: false, D: false,
    Q: false, E: false,
};

let is3D = false;

let SCALE = 1;

ctx.imageSmoothingEnabled = false;

let W = c.width / SCALE;
let H = c.height / SCALE;

let lastTime = 0;
let fps = 0;

const buffer = document.createElement('canvas');
buffer.width = W;
buffer.height = H;
let bctx = buffer.getContext('2d');

let imageData = bctx.createImageData(W, H);
let pixels = imageData.data;

let zBuffer = new Float32Array(W * H);

const R = (val) => {
    return Math.round(val);
}

function writeUI() {
    ctx.fillStyle = 'white';
    ctx.font = `13px consolas`;
    ctx.fillText(`FPS: ${fps}`, 10, 16);
}

function writeCoord(ox, oy, x, y) {
    ctx.fillStyle = 'white';
    ctx.font = `12px consolas`;
    ctx.fillText(`(${ox},${oy})`, x, y + 10);
}

function putPixel(x, y, r, g, b) {
    if (x < 0 || x >= W || y < 0 || y >= H) return;
    const i = (y * W + x) * 4;
    pixels[i] = r;
    pixels[i + 1] = g;
    pixels[i + 2] = b;
    pixels[i + 3] = 255;
}

function putPixelZ(x, y, z, r, g, b) {
    if (x < 0 || x >= W || y < 0 || y >= H) return;
    const idx = y * W + x;
    if (z >= project3D.zBuffer[idx]) return; // skip if farther
    project3D.zBuffer[idx] = z;

    const i = idx * 4;
    pixels[i] = r;
    pixels[i + 1] = g;
    pixels[i + 2] = b;
    pixels[i + 3] = 255;
}

function loadTexture(img) {
    const c = document.createElement('canvas');
    c.width = img.width;
    c.height = img.height;
    const cx = c.getContext('2d');
    cx.drawImage(img, 0, 0);
    return cx.getImageData(0, 0, img.width, img.height);
}

const wallTexImg = new Image();
wallTexImg.src = './resource/doom-wall.png';
const ceilTexImg = new Image();
ceilTexImg.src = './resource/doom-ceiling.png';
const floorTexImg = new Image();
floorTexImg.src = './resource/floor2.jpg';

let WALL_TEX;
let FLOOR_TEX;
let CEIL_TEX;

const calcEndPoint = (x1, y1, d, angleInRadians) => {
    let x2 = (x1 + d * Math.cos(angleInRadians));
    let y2 = (y1 + d * Math.sin(angleInRadians));

    return { x2, y2 };
}

const pointInSector = (sector, px, py) => {
    let count = 0;
    for (let wall of sector.walls) {
        let { x1, y1, x2, y2 } = wall;
        if (((y1 > py) != (y2 > py)) &&
            (px < ((x2 - x1) * (py - y1)) / (y2 - y1) + x1)) {
            count++;
        }
    }
    return (count % 2) === 1;
}

const drawLine = (x1, y1, x2, y2, r = 255, g = 255, b = 255) => {
    let x0_ = x1;
    let y0_ = y1;
    let x1_ = x2;
    let y1_ = y2;

    let dx = Math.abs(x1_ - x0_);
    let dy = -Math.abs(y1_ - y0_);
    let sx = x0_ < x1_ ? 1 : -1;
    let sy = y0_ < y1_ ? 1 : -1;
    let err = dx + dy;

    while (true) {
        putPixel(x0_, y0_, r, g, b);
        if (x0_ === x1_ && y0_ === y1_) break;

        const e2 = err << 1;
        if (e2 >= dy) { err += dy; x0_ += sx; }
        if (e2 <= dx) { err += dx; y0_ += sy; }
    }
}

const drawRect = (cx, cy, w, h, angle = 0, r = 255, g = 255, b = 255) => {
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);

    const hw = w / 2;
    const hh = h / 2;

    const corners = [
        { x: -hw, y: -hh },
        { x: hw, y: -hh },
        { x: hw, y: hh },
        { x: -hw, y: hh },
    ];

    const rotated = corners.map(p => ({
        x: Math.round(cx + p.x * cos - p.y * sin),
        y: Math.round(cy + p.x * sin + p.y * cos),
    }));

    for (let i = 0; i < 4; i++) {
        const next = (i + 1) % 4;
        drawLine(rotated[i].x, rotated[i].y, rotated[next].x, rotated[next].y, r, g, b);
    }
};

class Player {
    constructor(x, y) {
        this.x = x;
        this.y = y;

        this.velX = 0;
        this.velY = 0;

        this.canMoveForward = true;
        this.canMoveBack = true;

        this.isMoving = false;

        this.eyeLevel = -40;

        this.rotVel = 0;
        this.speed = 2.5;
        this.rotSpeed = 2;
        this.dx = 0;
        this.dy = 0;
        this.angle = 90;
        this.w = 4;
        this.h = 4;
        this.FOV = 90;
        this.rayLength = 1000;
        this.numRays = 2;
        this.currentSector;
        this.lastSector;
        this.offsetAngles = Array.from({ length: this.numRays }, (v, k) => (k * ((this.FOV + 120) / this.numRays) - (this.FOV / 2))); // [1, 90] (+ 120 cause it is what the player actually sees)
        this.raysCoordinates = []; //{x1, y1, x2, y2}
    }

    movement() {
        const angleInRad = this.angle * (Math.PI / 180);
        this.dx = Math.sin(angleInRad) * this.speed;
        this.dy = -Math.cos(angleInRad) * this.speed;

        if (K.u) {
            if (this.canMoveForward) {
                this.isMoving = true;
                this.x += this.dx;
                this.y += this.dy;
                this.getCurrectSector();
            }
        } else if (K.d) {
            if (this.canMoveBack) {
                this.isMoving = true;
                this.x += -this.dx;
                this.y += -this.dy;
                this.getCurrectSector();
            }
        }
        if (K.l) {
            this.isMoving = true;
            this.rotVel = -this.rotSpeed;
        } else if (K.r) {
            this.isMoving = true;
            this.rotVel = this.rotSpeed;
        } else {
            this.isMoving = false;
            this.dx = 0;
            this.dy = 0;
            this.rotVel = 0;
        }

        this.angle += this.rotVel;

        this.prepRayPoints();
    }

    prepRayPoints() {
        for (let i = 0; i < this.offsetAngles.length; i++) {
            let { x1, y1, x2, y2 } = this.calcRayPoint(this.offsetAngles[i], this.rayLength);
            this.raysCoordinates[i] = { x1, y1, x2, y2 };
        }
    }

    calcRayPoint(rayOffsetAngle, rayLenth) {
        let x1 = this.x + this.w / 2;
        let y1 = this.y + this.h / 2;

        let { x2, y2 } = calcEndPoint(x1, y1, rayLenth, ((rayOffsetAngle + (this.angle - 90)) * (Math.PI / 180))); // convert angle to radians 

        return { x1, y1, x2, y2 };
    }

    drawFov() {
        const centerX = Math.round(this.x + this.w / 2);
        const centerY = Math.round(this.y + this.h / 2);

        for (let r of this.offsetAngles) {
            const totalAngle = (this.angle + r) * Math.PI / 180;
            const lineX = Math.round(centerX + Math.sin(totalAngle) * this.rayLength);
            const lineY = Math.round(centerY - Math.cos(totalAngle) * this.rayLength);

            drawLine(centerX, centerY, lineX, lineY, 255, 255, 0);
        }
    }

    draw() {
        let angleInRad = this.angle * Math.PI / 180;
        drawRect(this.x + this.w / 2, this.y + this.h / 2, this.w, this.h, angleInRad, 255, 0, 0);
    }


    getCurrectSector() {
        let found = false;

        for (let i = 0; i < sectors.length; i++) {
            if (pointInSector(sectors[i], this.x, this.y)) {
                this.currentSector = sectors[i];
                found = true;
                break;
            }
        }

        if (!found) {
            this.currentSector = this.lastSector;
        }

        this.lastSector = this.currentSector;
    }


    update() {
        this.draw();
        this.drawFov();
    }
}

const findIntersection = (x1, y1, x2, y2, x3, y3, x4, y4) => {
    const denom = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);
    if (denom === 0) {
        return null; // lines are parallel or coincident
    }

    const t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / denom;
    const u = -((x1 - x2) * (y1 - y3) - (y1 - y2) * (x1 - x3)) / denom;

    if (t >= 0 && t <= 1 && u >= 0 && u <= 1) {
        const intersectionX = x1 + t * (x2 - x1);
        const intersectionY = y1 + t * (y2 - y1);

        return { x: intersectionX, y: intersectionY };
    }

    return null; // No intersection
}

function pointInTriangle(px, py, x1, y1, x2, y2, x3, y3) {
    const d1 = (px - x2) * (y1 - y2) - (x1 - x2) * (py - y2);
    const d2 = (px - x3) * (y2 - y3) - (x2 - x3) * (py - y3);
    const d3 = (px - x1) * (y3 - y1) - (x3 - x1) * (py - y1);

    const hasNeg = (d1 < 0) || (d2 < 0) || (d3 < 0);
    const hasPos = (d1 > 0) || (d2 > 0) || (d3 > 0);

    return !(hasNeg && hasPos);
}


class Line {
    constructor(x1, y1, x2, y2, isPortal, neighbor, r = null, g = null, b = null) {
        this.x1 = x1 | 0;
        this.y1 = y1 | 0;
        this.x2 = x2 | 0;
        this.y2 = y2 | 0;
        this.r = r;
        this.g = g;
        this.b = b;

        this.ox1 = x1; // keep original
        this.oy1 = y1;
        this.ox2 = x2;
        this.oy2 = y2;

        this.sector;

        this.isPortal = isPortal;
        this.neighbor = neighbor;

        this.wh = 50;

        this.isVisible = false;

        this.r = r ?? 0;
        this.g = g ?? 255;
        this.b = b ?? 0;

        this.texture = WALL_TEX;
    }

    checkIsVisible() {
        let [p1x, p1y] = [this.x1, this.y1];
        let [p2x, p2y] = [this.x2, this.y2];
        let [x1, y1, x2, y2, x3, y3] = [p.x, p.y, p.raysCoordinates[0].x2, p.raysCoordinates[0].y2, p.raysCoordinates[1].x2, p.raysCoordinates[1].y2];

        let p1Codition = pointInTriangle(p1x, p1y, x1, y1, x2, y2, x3, y3);
        let p2Codition = pointInTriangle(p2x, p2y, x1, y1, x2, y2, x3, y3);

        // calc intersection
        let leftIntersectCondition = findIntersection(p1x, p1y, p2x, p2y, x1, y1, x2, y2);
        let rightIntersectCondition = findIntersection(p1x, p1y, p2x, p2y, x1, y1, x3, y3);


        this.isVisible = (p1Codition || p2Codition || leftIntersectCondition || rightIntersectCondition) ?? false;
        this.r = this.isVisible ? 255 : 0;
    }

    draw() {
        drawLine(this.x1, this.y1, this.x2, this.y2, this.r, this.g, this.b);
    }
}


class Sector {
    constructor(fh, ch, walls, neighbors = []) {
        this.fh = fh;
        this.ch = ch;
        this.walls = walls;
        this.neighbors = neighbors;

        this.fTexture = FLOOR_TEX;
        this.cTexture = CEIL_TEX;
    }

    assignSectorToWalls() {
        for (let w of this.walls) {
            w.sector = this;
        }
    }
}


const scale = 8;
const p = new Player(10, 10);
const sector1 = new Sector(0, 130, []); // Normal room
const sector2 = new Sector(-10, 100, []); // Raised platform
const sector3 = new Sector(-20, 200, []); // Raised platform

const l1 = new Line(20, 15, 30, 5);
const l2 = new Line(30, 5, 50, 5);
const l3 = new Line(50, 5, 60, 15);
const l4 = new Line(60, 15, 55, 30);
const l5 = new Line(55, 30, 30, 30, true, sector2);
const l6 = new Line(30, 30, 20, 15);

sector1.walls = [l1, l2, l3, l4, l5, l6];

const l5b = new Line(30, 30, 55, 30, true, sector1);
const l7 = new Line(55, 30, 65, 40);
const l8 = new Line(65, 40, 60, 55);
const l9 = new Line(60, 55, 30, 55, true, sector3);
const l10 = new Line(30, 55, 20, 45);
const l11 = new Line(20, 45, 30, 30); // Connects back to the start of l5b

sector2.walls = [l5b, l7, l8, l9, l10, l11];

const l9b = new Line(60, 55, 30, 55, true, sector2); // top line
const l12 = new Line(60, 55, 70, 75); // right line
const l13 = new Line(70, 75, 60, 85); // right line
const l14 = new Line(60, 85, 30, 85); // bottom line
const l15 = new Line(30, 85, 20, 75); // left line
const l16 = new Line(20, 75, 30, 55); // left line

sector3.walls = [l9b, l12, l13, l14, l15, l16];

const map = [
    l1, l2, l3, l4, l5, l6,
    l5b, l7, l8, l9, l10, l11,
    l9b, l12, l13, l14, l15, l16
];


let minX = Infinity;
let minY = Infinity;

map.forEach(line => {
    minX = Math.min(minX, line.x1, line.x2);
    minY = Math.min(minY, line.y1, line.y2);
});

map.forEach(line => {
    line.x1 = (line.x1 - minX) * scale;
    line.y1 = (line.y1 - minY) * scale;
    line.x2 = (line.x2 - minX) * scale;
    line.y2 = (line.y2 - minY) * scale;
});

const sectors = [sector1, sector2, sector3];


sectors.forEach(sector => { sector.assignSectorToWalls(); });


wallTexImg.onload = () => {
    WALL_TEX = loadTexture(wallTexImg);
    map.forEach((l) => l.texture = WALL_TEX);
};
floorTexImg.onload = () => {
    FLOOR_TEX = loadTexture(floorTexImg);
    sectors.forEach((s) => s.fTexture = FLOOR_TEX);
}
ceilTexImg.onload = () => {
    CEIL_TEX = loadTexture(ceilTexImg);
    sectors.forEach((s) => s.cTexture = CEIL_TEX);
}


class Project3D {
    constructor() {
        this.fovInRad = (p.FOV) * (Math.PI / 180);
        this.halfSW = W / 2;
        this.fovFactor = this.halfSW / Math.tan(this.fovInRad / 2);
        this.NEAR = 10;
    }

    drawTexturedWall(x1, y1Top, y1Bottom, x2, y2Top, y2Bottom, texture, ry1, ry2, isPortal = false) {
        if (!texture) return;

        if (x2 < x1) {
            [x1, x2] = [x2, x1];
            [y1Top, y2Top] = [y2Top, y1Top];
            [y1Bottom, y2Bottom] = [y2Bottom, y1Bottom];
            [ry1, ry2] = [ry2, ry1];
        }

        const dx = x2 - x1;
        if (dx <= 0) return;

        const iz1 = 1 / ry1;
        const iz2 = 1 / ry2;
        const u1 = 0 * iz1;
        const u2 = texture.width * iz2;

        for (let x = x1; x <= x2; x++) {
            const t = (x - x1) / dx;
            const currentIZ = iz1 + (iz2 - iz1) * t;
            const currentUZ = u1 + (u2 - u1) * t;
            const texX = (currentUZ / currentIZ) | 0;
            // const wrappedTexX = Math.abs(texX % texture.width);
            let wrappedTexX = texX;
            if(wrappedTexX >= texture.width) wrappedTexX -= texture.width;

            const top = y1Top + (y2Top - y1Top) * t;
            const bottom = y1Bottom + (y2Bottom - y1Bottom) * t;
            const depth = ry1 + t * (ry2 - ry1);

            if (bottom <= top) continue;

            // Only skip for opaque walls
            if (!isPortal && depth >= zBuffer[x]) continue;
            if (!isPortal) zBuffer[x] = depth;

            const colHeight = bottom - top;
            const vStep = texture.height / colHeight;
            let v = 0;

            const ry = 1 / currentIZ;
            const shade = R(255 - ry * 0.15, 40, 255);

            for (let y = Math.floor(top); y < Math.ceil(bottom); y++) {
                // const texY = (v | 0) % texture.height;
                let texY = v | 0;
                if (texY >= texture.height) texY -= texture.height;

                const i = (texY * texture.width + wrappedTexX) * 4;

                putPixelZ(
                    x, y, depth,
                    (texture.data[i] * shade) >> 8,
                    (texture.data[i + 1] * shade) >> 8,
                    (texture.data[i + 2] * shade) >> 8
                );
                v += vStep;
            }
        }
    }

    fillPolygonTextured(vertices, texture) {
        if (vertices.length < 3) return;

        // triangulate as fan
        const v0 = vertices[0];

        for (let i = 1; i < vertices.length - 1; i++) {
            this.drawTexturedTriangle(
                v0,
                vertices[i],
                vertices[i + 1],
                texture
            );
        }
    }

    drawTexturedTriangle(v0, v1, v2, texture) {
        // bounding box
        const minX = Math.max(0, Math.floor(Math.min(v0.x, v1.x, v2.x)));
        const maxX = Math.min(W - 1, Math.ceil(Math.max(v0.x, v1.x, v2.x)));
        const minY = Math.max(0, Math.floor(Math.min(v0.y, v1.y, v2.y)));
        const maxY = Math.min(H - 1, Math.ceil(Math.max(v0.y, v1.y, v2.y)));

        v0.invZ = 1 / v0.ry;
        v1.invZ = 1 / v1.ry;
        v2.invZ = 1 / v2.ry;

        v0.wxz = v0.wx * v0.invZ;
        v0.wyz = v0.wy * v0.invZ;
        v1.wxz = v1.wx * v1.invZ;
        v1.wyz = v1.wy * v1.invZ;
        v2.wxz = v2.wx * v2.invZ;
        v2.wyz = v2.wy * v2.invZ;

        const area =
            (v1.x - v0.x) * (v2.y - v0.y) -
            (v2.x - v0.x) * (v1.y - v0.y);

        if (area === 0) return;

        for (let y = minY; y <= maxY; y++) {
            for (let x = minX; x <= maxX; x++) {

                const w0 =
                    ((v1.x - x) * (v2.y - y) - (v2.x - x) * (v1.y - y)) / area;
                const w1 =
                    ((v2.x - x) * (v0.y - y) - (v0.x - x) * (v2.y - y)) / area;
                const w2 = 1 - w0 - w1;

                if (w0 < 0 || w1 < 0 || w2 < 0) continue;

                const invZ =
                    w0 * v0.invZ +
                    w1 * v1.invZ +
                    w2 * v2.invZ;

                const wx =
                    (w0 * v0.wxz +
                        w1 * v1.wxz +
                        w2 * v2.wxz) / invZ;

                const wy =
                    (w0 * v0.wyz +
                        w1 * v1.wyz +
                        w2 * v2.wyz) / invZ;

                const depth = 1 / invZ;

                if (depth >= zBuffer[x]) continue;

                const u = ((wx * texture.width * 0.02) | 0) % texture.width;
                const v = ((wy * texture.height * 0.02) | 0) % texture.height;

                const i = (v * texture.width + u) * 4;
                putPixelZ(
                    x, y, depth,
                    texture.data[i],
                    texture.data[i + 1],
                    texture.data[i + 2]
                );
            }
        }
    }

    projectWall(l) {
        const eyeHeightInWorld = p.currentSector.fh + p.eyeLevel;
        const currentSector = l.sector;
        const fh = currentSector.fh;
        const ch = currentSector.ch;
        const wh = ch - fh;

        const dx1 = l.x1 - p.x;
        const dy1 = l.y1 - p.y;
        const dx2 = l.x2 - p.x;
        const dy2 = l.y2 - p.y;

        const angleInRad = p.angle * (Math.PI / 180);

        let rx1 = dx1 * Math.cos(angleInRad) + dy1 * Math.sin(angleInRad);
        let ry1 = dx1 * Math.sin(angleInRad) - dy1 * Math.cos(angleInRad);
        let rx2 = dx2 * Math.cos(angleInRad) + dy2 * Math.sin(angleInRad);
        let ry2 = dx2 * Math.sin(angleInRad) - dy2 * Math.cos(angleInRad);

        if (ry1 <= this.NEAR && ry2 <= this.NEAR) return;

        let wx1 = l.x1, wy1 = l.y1;
        let wx2 = l.x2, wy2 = l.y2;

        if (ry1 < this.NEAR || ry2 < this.NEAR) {
            const t = (this.NEAR - ry1) / (ry2 - ry1);

            const cx = wx1 + (wx2 - wx1) * t;
            const cy = wy1 + (wy2 - wy1) * t;

            if (ry1 < this.NEAR) {
                wx1 = cx; wy1 = cy;
            } else {
                wx2 = cx; wy2 = cy;
            }

            const ndx1 = wx1 - p.x;
            const ndy1 = wy1 - p.y;
            const ndx2 = wx2 - p.x;
            const ndy2 = wy2 - p.y;

            rx1 = ndx1 * Math.cos(angleInRad) + ndy1 * Math.sin(angleInRad);
            ry1 = ndx1 * Math.sin(angleInRad) - ndy1 * Math.cos(angleInRad);

            rx2 = ndx2 * Math.cos(angleInRad) + ndy2 * Math.sin(angleInRad);
            ry2 = ndx2 * Math.sin(angleInRad) - ndy2 * Math.cos(angleInRad);
        }


        let sx1 = (rx1 * this.fovFactor) / ry1;
        let sx2 = (rx2 * this.fovFactor) / ry2;

        let screenX1 = (this.halfSW + sx1);
        let screenX2 = (this.halfSW + sx2);

        let projH1 = (wh * this.fovFactor) / ry1;
        let projH2 = (wh * this.fovFactor) / ry2;

        let sy1T = ((H / 2) - (projH1 / 2));
        let sy2T = ((H / 2) - (projH2 / 2));

        let screenY1 = ((H / 2) + ((fh - eyeHeightInWorld) * this.fovFactor) / ry1);
        let screenY2 = ((H / 2) + ((fh - eyeHeightInWorld) * this.fovFactor) / ry2);

        return ({
            wall: l,
            screenX1, screenX2,
            sy1T, sy2T,
            screenY1, screenY2,
            ry1, ry2,
            wx1, wy1, wx2, wy2,
            fh, ch
        });
    }


    projectSectorEdge(l, sector) {
        const eyeHeightInWorld = p.currentSector.fh + p.eyeLevel;
        const fh = sector.fh;
        const ch = sector.ch;
        const wh = ch - fh;

        const dx1 = l.x1 - p.x;
        const dy1 = l.y1 - p.y;
        const dx2 = l.x2 - p.x;
        const dy2 = l.y2 - p.y;

        const a = p.angle * Math.PI / 180;
        const cos = Math.cos(a);
        const sin = Math.sin(a);

        let rx1 = dx1 * cos + dy1 * sin;
        let ry1 = dx1 * sin - dy1 * cos;
        let rx2 = dx2 * cos + dy2 * sin;
        let ry2 = dx2 * sin - dy2 * cos;

        const near = this.NEAR;

        if (ry1 < near) ry1 = near;
        if (ry2 < near) ry2 = near;

        let sx1 = (rx1 * this.fovFactor) / ry1;
        let sx2 = (rx2 * this.fovFactor) / ry2;

        let screenX1 = (this.halfSW + sx1);
        let screenX2 = (this.halfSW + sx2);

        let projH1 = (wh * this.fovFactor) / ry1;
        let projH2 = (wh * this.fovFactor) / ry2;

        let sy1T = ((H / 2) - (projH1 / 2));
        let sy2T = ((H / 2) - (projH2 / 2));

        let screenY1 = ((H / 2) + ((fh - eyeHeightInWorld) * this.fovFactor) / ry1);
        let screenY2 = ((H / 2) + ((fh - eyeHeightInWorld) * this.fovFactor) / ry2);

        return {
            screenX1, screenX2,
            sy1T, sy2T,
            screenY1, screenY2,
            ry1, ry2,
            wx1: l.x1, wy1: l.y1,
            wx2: l.x2, wy2: l.y2,
            fh, ch
        };
    }


    project() {
        if (!p.currentSector) return;

        this.zBuffer = new Float32Array(W);
        this.zBuffer.fill(Infinity);

        const eyeHeightInWorld = p.currentSector.fh + p.eyeLevel;
        const visibleWalls = map.filter(l => (l.isVisible));

        for (let s of sectors) {
            const projectedWalls = [];
            const ceilingVert = [];
            const floorVert = [];

            for (const l of s.walls) {
                const w = this.projectWall(l);

                if (w) projectedWalls.push(w);

                const c = this.projectSectorEdge(l, s);

                ceilingVert.push({ x: c.screenX1, y: c.sy1T, wx: c.wx1, wy: c.wy1, ry: c.ry1 });
                ceilingVert.push({ x: c.screenX2, y: c.sy2T, wx: c.wx2, wy: c.wy2, ry: c.ry2 });

                floorVert.push({ x: c.screenX1, y: c.screenY1, wx: c.wx1, wy: c.wy1, ry: c.ry1 });
                floorVert.push({ x: c.screenX2, y: c.screenY2, wx: c.wx2, wy: c.wy2, ry: c.ry2 });
            }

            this.fillPolygonTextured(ceilingVert, s.cTexture);
            this.fillPolygonTextured(floorVert, s.fTexture);


            for (let w of projectedWalls) {
                const l = w.wall;

                if (!visibleWalls.includes(l)) continue;

                const fh = l.sector.fh;
                const ch = l.sector.ch;

                if (l.isPortal) {
                    const nSector = l.neighbor;
                    const nFh = nSector.fh;
                    const nCh = nSector.ch;
                    const nWh = nCh - nFh;

                    let curCeil1 = w.sy1T;
                    let curCeil2 = w.sy2T;

                    let curFloor1 = w.screenY1;
                    let curFloor2 = w.screenY2;

                    let neighFloor1 = (
                        (H / 2) + ((nFh - eyeHeightInWorld) * this.fovFactor) / w.ry1
                    );
                    let neighFloor2 = (
                        (H / 2) + ((nFh - eyeHeightInWorld) * this.fovFactor) / w.ry2
                    );

                    let nProjH1 = (nWh * this.fovFactor) / w.ry1;
                    let nProjH2 = (nWh * this.fovFactor) / w.ry2;

                    let neighCeil1 = ((H / 2) - (nProjH1 / 2));
                    let neighCeil2 = ((H / 2) - (nProjH2 / 2));

                    if (nFh < fh) {
                        this.drawTexturedWall(R(w.screenX1), R(neighFloor1), R(curFloor1), R(w.screenX2), R(neighFloor2), R(curFloor2), l.texture, w.ry1, w.ry2, true);
                    }
                    if (nCh > ch) {
                        this.drawTexturedWall(R(w.screenX1), R(neighCeil1), R(curCeil1), R(w.screenX2), R(neighCeil2), R(curCeil2), l.texture, w.ry1, w.ry2, true);
                    }

                } else {
                    this.drawTexturedWall(R(w.screenX1), R(w.sy1T), R(w.screenY1), R(w.screenX2), R(w.sy2T), R(w.screenY2), l.texture, w.ry1, w.ry2);
                }
            }
        }
    }
}


let project3D = new Project3D();

const update = () => {
    for (let i = 0; i < W * H; i++) zBuffer[i] = Infinity;

    p.movement();

    if (!is3D) {
        p.update();
        map.forEach((l) => {
            l.draw();
            if (p.isMoving) l.checkIsVisible();
        });
    } else {
        project3D.project();
        map.forEach(l => l.checkIsVisible());
    }
}

const render = (currentTime) => {
    pixels.fill(0);

    update();

    bctx.putImageData(imageData, 0, 0);

    ctx.clearRect(0, 0, c.width, c.height);
    ctx.drawImage(buffer, 0, 0, W * SCALE, H * SCALE);


    const deltaTime = currentTime - lastTime;
    lastTime = currentTime;

    if (deltaTime > 0) {
        fps = R(1000 / deltaTime);

        if (fps <= 30) {
            p.speed = 5;
            p.rotSpeed = 4;
        } else {
            p.speed = 2.5;
            p.rotSpeed = 2;
        }
    }

    writeUI();

    if (!is3D) {
        map.forEach((l) => {
            writeCoord(l.ox1, l.oy1, l.x1, l.y1);
            writeCoord(l.ox2, l.oy2, l.x2, l.y2);
        });
    }
};

function engine(currentTime) {
    render(currentTime);
    requestAnimationFrame(engine);
}

requestAnimationFrame(engine);  