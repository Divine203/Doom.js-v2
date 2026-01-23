const c = document.querySelector('#c');
const ctx = c.getContext('2d');

const SCALE = 6;

ctx.imageSmoothingEnabled = false;

const W = c.width / SCALE;
const H = c.height / SCALE;

const buffer = document.createElement('canvas');
buffer.width = W;
buffer.height = H;
const bctx = buffer.getContext('2d');

const imageData = bctx.createImageData(W, H);
const pixels = imageData.data;

function putPixel(x, y, r, g, b) {
    if (x < 0 || x >= W || y < 0 || y >= H) return;
    const i = (y * W + x) * 4;
    pixels[i] = r;
    pixels[i + 1] = g;
    pixels[i + 2] = b;
    pixels[i + 3] = 255;
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

const calcEndPoint = (x1, y1, d, angleInRadians) => {
    let x2 = (x1 + d * Math.cos(angleInRadians));
    let y2 = (y1 + d * Math.sin(angleInRadians));

    return { x2, y2 };
}

const R = (val) => {
    return Math.round(val);
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
        this.FOV = 66;
        this.rayLength = 900;
        this.numRays = 17;
        this.currentSector;
        this.lastSector;
        this.offsetAngles = Array.from({ length: this.numRays }, (v, k) => (k * (this.FOV / this.numRays) - (this.FOV / 2))); // [1, 90]
        this.raysCoordinates = []; //{x1, y1, x2, y2}
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
            this.dx = 0;
            this.dy = 0;
            this.rotVel = 0;
        }

        this.angle += this.rotVel;
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

class Line {
    constructor(x1, y1, x2, y2, isPortal, neighbor, r = null, g = null, b = null) {
        this.x1 = x1 | 0;
        this.y1 = y1 | 0;
        this.x2 = x2 | 0;
        this.y2 = y2 | 0;
        this.r = r;
        this.g = g;
        this.b = b;

        this.sector;

        this.isPortal = isPortal;
        this.neighbor = neighbor;

        this.wh = 50;

        this.isVisible = false;

        // Default random-ish color if none provided
        this.r = r ?? R(Math.random() * 200 + 50);
        this.g = g ?? R(Math.random() * 200 + 50);
        this.b = b ?? R(Math.random() * 200 + 50);
    }

    draw() {
        drawLine(this.x1, this.y1, this.x2, this.y2, this.r, this.g, this.b);
    }

    checkIfVisible() {
        this.isVisible = false; // reset at start

        for (let i = 0; i < p.raysCoordinates.length; i++) {
            const rc = p.raysCoordinates[i];
            const intersectionP = findIntersection(rc.x1, rc.y1, rc.x2, rc.y2, this.x1, this.y1, this.x2, this.y2);

            if (intersectionP) {
                this.isVisible = true;
                break;
            }
        }
    }
}


class Sector {
    constructor(fh, ch, walls, neighbors = []) {
        this.fh = fh;
        this.ch = ch;
        this.walls = walls;
        this.neighbors = neighbors;
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

const l1 = new Line(20, 15, 30, 5);
const l2 = new Line(30, 5, 50, 5);
const l3 = new Line(50, 5, 60, 15);
const l4 = new Line(60, 15, 55, 30);
const l5 = new Line(55, 30, 30, 30, true, sector2);
const l6 = new Line(30, 30, 20, 15);

sector1.walls = [l1, l2, l3, l4, l5, l6];

const l7 = new Line(55, 30, 65, 40);
const l8 = new Line(65, 40, 60, 55);
const l9 = new Line(60, 55, 30, 55);
const l10 = new Line(30, 55, 20, 45);
const l11 = new Line(20, 45, 30, 30);
const l5b = new Line(30, 30, 55, 30, true, sector1); // backref to sector1

sector2.walls = [l5b, l7, l8, l9, l10, l11];

const map = [
    l1, l2, l3, l4, l5, l6,
    l7, l8, l9, l10, l11
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
const sectors = [sector1, sector2];

sectors.forEach(sector => { sector.assignSectorToWalls(); })


class Project3D {
    constructor() {
        this.fovInRad = p.FOV * (Math.PI / 180);
        this.halfSW = W / 2;
        this.fovFactor = this.halfSW / Math.tan(this.fovInRad / 2);
        this.NEAR = 10;
    }

    drawVertex(x, y) {
        putPixel(x, y, 255, 255, 255);
    }


    drawWall(x1, y1Top, y1Bottom, x2, y2Top, y2Bottom, r, g, b) {
        drawLine(x1, y1Top, x1, y1Bottom, r, g, b);
        drawLine(x1, y1Bottom, x2, y2Bottom, r, g, b);
        drawLine(x2, y2Bottom, x2, y2Top, r, g, b);
        drawLine(x2, y2Top, x1, y1Top, r, g, b);
    }

    normalizeAngle(angle) {
        return Math.atan2(Math.sin(angle), Math.cos(angle)); // Keeps it between -π and π
    }

    getVisibleWalls() {
        const visibleWalls = map;

        visibleWalls.sort((a, b) => {
            const dzA = this.getWallDepth(a);
            const dzB = this.getWallDepth(b);
            return dzB - dzA;
        });

        return visibleWalls.filter(l => (l.isVisible));
    }

    getWallDepth(wall) {
        const mx = (wall.x1 + wall.x2) / 2 - p.x;
        const my = (wall.y1 + wall.y2) / 2 - p.y;

        const angleRad = p.angle * Math.PI / 180;
        const sin = Math.sin(angleRad);
        const cos = Math.cos(angleRad);

        const ry = mx * sin - my * cos; // this is Z in camera space (forward direction)
        return ry;
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

            // recompute dx/dy AFTER clipping
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

        return({
            wall: l,
            screenX1, screenX2,
            sy1T, sy2T,
            screenY1, screenY2,
            ry1, ry2,
            wx1, wy1, wx2, wy2,
            fh, ch
        });
    }

    project() {
        if (!p.currentSector) return;
        const eyeHeightInWorld = p.currentSector.fh + p.eyeLevel;

        const visibleWalls = this.getVisibleWalls();

        for (let s of sectors) {
            const projectedWalls = [];

            for (const l of s.walls) {
                const w = this.projectWall(l);
                if (w) projectedWalls.push(w);
            }


            for (let w of projectedWalls) {
                const l = w.wall;

                if (!visibleWalls.includes(l)) continue;

                const fh = l.sector.fh; const ch = l.sector.ch; const wh = ch - fh;


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
                        this.drawWall(R(w.screenX1), R(neighFloor1), R(curFloor1), R(w.screenX2), R(neighFloor2), R(curFloor2), l.r, l.g, l.b);
                    }
                    if (nCh < ch) {
                        this.drawWall(R(w.screenX1), R(neighCeil1), R(curCeil1), R(w.screenX2), R(neighCeil2), R(curCeil2), l.r, l.g, l.b);

                    }

                } else {
                    this.drawWall(R(w.screenX1), R(w.sy1T), R(w.screenY1), R(w.screenX2), R(w.sy2T), R(w.screenY2), l.r, l.g, l.b);
                }
            }
        }

    }
}


const project3D = new Project3D();


const update = () => {
    p.movement();
    if (p.isMoving) {
        map.forEach((l) => { l.checkIfVisible() });
    }
    p.prepRayPoints();

    if (!is3D) {
        p.update();
        map.forEach((l) => { l.draw() });
    } else {
        project3D.project();
    }

}

const render = () => {
    pixels.fill(0);

    update();

    bctx.putImageData(imageData, 0, 0);

    ctx.clearRect(0, 0, c.width, c.height);
    ctx.drawImage(buffer, 0, 0, W * SCALE, H * SCALE);
};

function engine() {
    render();
    requestAnimationFrame(engine);
}

requestAnimationFrame(engine);