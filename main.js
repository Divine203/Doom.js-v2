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

const R = (val) => {
    return Math.round(val);
}

let W = R(c.width / SCALE);
let H = R(c.height / SCALE);

let lastTime = 0;
let fps = 0;

const buffer = document.createElement('canvas');
buffer.width = W;
buffer.height = H;
let bctx = buffer.getContext('2d');

let imageData = bctx.createImageData(W, H);
let pixels = imageData.data;

let zBuffer = new Float32Array(W * H);

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
    if (z >= project3D.zBuffer[idx]) return;
    project3D.zBuffer[idx] = z;

    // --- FOG CALCULATION ---
    const maxDist = 700; // Anything beyond this is pitch black
    const minDist = 50;  // Anything closer than this is full brightness

    // Calculate shade: 1.0 (close) to 0.0 (far)
    let shade = (maxDist - z) / (maxDist - minDist);

    // Clamp shade between 0 and 1
    if (shade < 0) shade = 0;
    if (shade > 1) shade = 1;

    // Apply shade to colors
    const i = idx * 4;
    pixels[i] = r * shade;
    pixels[i + 1] = g * shade;
    pixels[i + 2] = b * shade;
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

let skyReady = false;

const wallTexImg = new Image();
wallTexImg.src = './resource/og-metal-wall.png';
const ceilTexImg = new Image();
ceilTexImg.src = './resource/ceiling-2.png';
const floorTexImg = new Image();
floorTexImg.src = './resource/floor.png';
const blueFloorTexImg = new Image();
blueFloorTexImg.src = './resource/blue-floor.png';
const skyImg = new Image();
skyImg.src = './resource/sky2.png';
const graniteTexImg = new Image();
graniteTexImg.src = './resource/granite1.png';
const gunTexImg = new Image();
gunTexImg.src = './resource/fps-gun.png';

let WALL_TEX;
let FLOOR_TEX;
let CEIL_TEX;
let SKY_TEX;
let BLUE_FLOOR_TEX;
let GRANITE_TEX;
let GUN_TEX;

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
        this.speed = 3;
        this.rotSpeed = 2.5;
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

        this.ghost = false;

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



const p = new Player(10, 10);


const sector1 = new Sector(-20, 200, []); //top left
const sector2 = new Sector(-20, 200, []); //top
const sector3 = new Sector(-20, 200, []); //top right

const sector4 = new Sector(-20, 200, []); //left
const sector5 = new Sector(-20, 200, []); //bottom left

const sector6 = new Sector(-20, 200, []); //bottom
const sector7 = new Sector(-20, 200, []); //bottom right

const sector8 = new Sector(-20, 200, []); //right



//center stage
const sector9 = new Sector(-10, 250, []); //pillar1 -- top left
const sector10 = new Sector(-10, 250, []); //step down -- top

const sector11 = new Sector(-10, 250, []); //pillar2 -- top right
const sector12 = new Sector(-10, 250, []); //step down -- right

const sector13 = new Sector(-10, 250, []); //pillar -- bottom right
const sector14 = new Sector(-10, 250, []); //step down -- bottom
const sector15 = new Sector(-10, 250, []); //pillar -- bottom left

const sector16 = new Sector(-10, 250, []); //step down -- left

const sector17 = new Sector(0, 300, []); //blue center
//


//room around stairs
const sector18 = new Sector(-20, 200, []); //top left
const sector19 = new Sector(-20, 200, []); //left
const sector20 = new Sector(-20, 200, []); //bottom left

const sector21 = new Sector(-20, 200, []); // top
const sector22 = new Sector(-20, 200, []); // center space infront of stairs
const sector23 = new Sector(-20, 200, []); // bottom


// stairs
const sector24 = new Sector(-40, 200, []);
const sector25 = new Sector(-60, 200, []);
const sector26 = new Sector(-80, 200, []);
const sector27 = new Sector(-100, 200, []);



const l1 = new Line(48, 40, 180, 40);
const l2 = new Line(180, 40, 180, 160, true, sector2);
const l3 = new Line(180, 160, 48, 160, true, sector4);
const l4 = new Line(48, 160, 48, 40);

sector1.walls = [l1, l2, l3, l4];

const l5 = new Line(180, 160, 180, 40, true, sector1); //l2
const l6 = new Line(180, 40, 328, 40);
const l7 = new Line(328, 40, 328, 160, true, sector3);
const l8 = new Line(328, 160, 180, 160, true, sector10); // l37

sector2.walls = [l5, l6, l7, l8];

const l9 = new Line(328, 160, 328, 40, true, sector2); // l7
const l10 = new Line(328, 40, 400, 40);
const l11 = new Line(400, 40, 400, 160);
const l12 = new Line(400, 160, 328, 160, true, sector8);

sector3.walls = [l9, l10, l11, l12];

const l13 = new Line(48, 160, 180, 160, true, sector1); //l3
const l14 = new Line(180, 160, 180, 280, true, sector16); // l64.
const l15 = new Line(180, 280, 48, 280, true, sector5);
const l16 = new Line(48, 280, 48, 160);
l16.ghost = true;

sector4.walls = [l13, l14, l15, l16];

const l17 = new Line(48, 280, 180, 280, true, sector4); // l15
const l18 = new Line(180, 280, 180, 350, true, sector6);
const l19 = new Line(180, 350, 48, 350);
const l20 = new Line(48, 350, 48, 280);

sector5.walls = [l17, l18, l19, l20];

const l21 = new Line(180, 350, 180, 280, true, sector5); //l18
const l22 = new Line(180, 280, 328, 280, true, sector14) //l55
const l23 = new Line(328, 280, 328, 350, true, sector7);
const l24 = new Line(328, 350, 180, 350);

sector6.walls = [l21, l22, l23, l24];

const l25 = new Line(328, 350, 328, 280, true, sector6); // l23
const l26 = new Line(328, 280, 400, 280, true, sector8);
const l27 = new Line(400, 280, 400, 350);
const l28 = new Line(400, 350, 328, 350);

sector7.walls = [l25, l26, l27, l28];

const l29 = new Line(400, 280, 328, 280, true, sector7);
const l30 = new Line(328, 280, 328, 160, true, sector12); // l46
const l31 = new Line(328, 160, 400, 160, true, sector3); // l12
const l32 = new Line(400, 160, 400, 280, true, sector19); //sector soon

sector8.walls = [l29, l30, l31, l32];


//center stage lines
const l33 = new Line(180, 160, 190, 160);
const l34 = new Line(190, 160, 190, 170);
const l35 = new Line(190, 170, 180, 170);
const l36 = new Line(180, 170, 180, 160);

sector9.walls = [l33, l34, l35, l36]; // pillar1

const l37 = new Line(190, 160, 318, 160, true, sector2);
const l38 = new Line(318, 160, 318, 170);
const l39 = new Line(318, 170, 190, 170, true, sector17); //sector soon
const l40 = new Line(190, 170, 190, 160);

sector10.walls = [l37, l38, l39, l40];

const l41 = new Line(318, 160, 328, 160);
const l42 = new Line(328, 160, 328, 170);
const l43 = new Line(328, 170, 318, 170);
const l44 = new Line(318, 170, 318, 160);

sector11.walls = [l41, l42, l43, l44]; //pillar2

const l45 = new Line(318, 170, 328, 170);
const l46 = new Line(328, 170, 328, 270, true, sector8);
const l47 = new Line(328, 270, 318, 270);
const l48 = new Line(318, 270, 318, 170, true, sector17); // sector soon

sector12.walls = [l45, l46, l47, l48];

const l49 = new Line(318, 270, 328, 270);
const l50 = new Line(328, 270, 328, 280);
const l51 = new Line(328, 280, 318, 280);
const l52 = new Line(318, 280, 318, 270);

sector13.walls = [l49, l50, l51, l52]; // pillar3

const l53 = new Line(190, 270, 318, 270, true, sector17); //sector soon
const l54 = new Line(318, 270, 318, 280);
const l55 = new Line(318, 280, 190, 280, true, sector6);
const l56 = new Line(190, 280, 190, 270);

sector14.walls = [l53, l54, l55, l56];

const l57 = new Line(180, 270, 190, 270);
const l58 = new Line(190, 270, 190, 280);
const l59 = new Line(190, 280, 180, 280);
const l60 = new Line(180, 280, 180, 270);

sector15.walls = [l57, l58, l59, l60]; // pillar4

const l61 = new Line(180, 170, 190, 170);
const l62 = new Line(190, 170, 190, 270, true, sector17); //sector soon
const l63 = new Line(190, 270, 180, 270);
const l64 = new Line(180, 270, 180, 170, true, sector4);

sector16.walls = [l61, l62, l63, l64];

const l65 = new Line(190, 170, 318, 170, true, sector10);
const l66 = new Line(318, 170, 318, 270, true, sector12);
const l67 = new Line(318, 270, 190, 270, true, sector14);
const l68 = new Line(190, 270, 190, 170, true, sector16);

sector17.walls = [l65, l66, l67, l68];
//

// room around stairs
const l69 = new Line(400, 40, 450, 40);
const l70 = new Line(450, 40, 450, 160, true, sector21); // portal soon
const l71 = new Line(450, 160, 400, 160, true, sector19);
const l72 = new Line(400, 160, 400, 40, true, sector8);

sector18.walls = [l69, l70, l71, l72];

const l73 = new Line(400, 160, 450, 160, true, sector18);
const l74 = new Line(450, 160, 450, 280, true, sector22);
const l75 = new Line(450, 280, 400, 280, true, sector20);
const l76 = new Line(400, 280, 400, 160, true, sector8);

sector19.walls = [l73, l74, l75, l76];

const l77 = new Line(400, 280, 450, 280, true, sector19);
const l78 = new Line(450, 280, 450, 350, true, sector23);
const l79 = new Line(450, 350, 400, 350);
const l80 = new Line(400, 350, 400, 280, true, sector8);

sector20.walls = [l77, l78, l79, l80];

const l81 = new Line(450, 40, 600, 40);
const l82 = new Line(600, 40, 600, 160);
const l83 = new Line(600, 160, 450, 160, true, sector22);
const l84 = new Line(450, 160, 450, 40, true, sector18);

sector21.walls = [l81, l82, l83, l84];

const l85 = new Line(450, 160, 500, 160, true, sector21);
const l86 = new Line(520, 160, 520, 220, true, sector24); // portal stairs soon
const l87 = new Line(500, 220, 450, 220, true, sector23);
const l88 = new Line(450, 220, 450, 160, true, sector19);

sector22.walls = [l85, l86, l87, l88];

const l89 = new Line(450, 220, 600, 220);
l89.ghost = true;
const l90 = new Line(600, 220, 600, 350);
const l91 = new Line(600, 350, 450, 350);
const l92 = new Line(450, 350, 450, 220, true, sector20);

sector23.walls = [l89, l90, l91, l92];
//


// stairs

const l93 = new Line(520, 160, 540, 160);
l93.ghost = true;
const l94 = new Line(540, 160, 540, 220, true, sector25);
const l95 = new Line(540, 220, 520, 220, true, sector23);
const l96 = new Line(520, 220, 520, 160, true, sector22);

sector24.walls = [l93, l94, l95, l96];

const l97 = new Line(540, 160, 560, 160);
l97.ghost = true;
const l98 = new Line(560, 160, 560, 220, true, sector26);
const l99 = new Line(560, 220, 540, 220, true, sector23);
const l100 = new Line(540, 220, 540, 160, true, sector24);

sector25.walls = [l97, l98, l99, l100];

const l101 = new Line(560, 160, 580, 160);
l101.ghost = true;
const l102 = new Line(580, 160, 580, 220, true, sector27);
const l103 = new Line(580, 220, 560, 220, true, sector23);
const l104 = new Line(560, 220, 560, 160, true, sector25);

sector26.walls = [l101, l102, l103, l104];

const l105 = new Line(580, 160, 580, 160);
l105.ghost = true;
const l106 = new Line(580, 160, 580, 220);
l106.ghost = true;
const l107 = new Line(580, 220, 580, 220, true, sector23);
const l108 = new Line(580, 220, 580, 160, true, sector26);

sector27.walls = [l105, l106, l107, l108];
//

const sectors = [
    sector1, sector2, sector3,
    sector4, sector5, sector6,
    sector7, sector8,

    sector9, sector10, sector11,
    sector12, sector13, sector14,
    sector15, sector16, sector17,

    sector18, sector19, sector20,
    sector21, sector22, sector23,

    sector24, sector25, sector26,
    sector27
];

const map = [];

for (let s of sectors) {
    for (let w of s.walls) {
        map.push(w);
    }
}

const scale = 1.5;


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
skyImg.onload = () => { SKY_TEX = loadTexture(skyImg); }
blueFloorTexImg.onload = () => {
    BLUE_FLOOR_TEX = loadTexture(blueFloorTexImg);
    sector17.fTexture = BLUE_FLOOR_TEX;
    sector16.fTexture = BLUE_FLOOR_TEX;
    sector14.fTexture = BLUE_FLOOR_TEX;
    sector12.fTexture = BLUE_FLOOR_TEX;
    sector10.fTexture = BLUE_FLOOR_TEX;
};
graniteTexImg.onload = () => {
    GRANITE_TEX = loadTexture(graniteTexImg);

    sector16.cTexture = GRANITE_TEX;
    sector14.cTexture = GRANITE_TEX;
    sector12.cTexture = GRANITE_TEX;
    sector10.cTexture = GRANITE_TEX;
}
gunTexImg.onload = () => {
    GUN_TEX = loadTexture(gunTexImg);
}


class Project3D {
    constructor() {
        this.fovInRad = (p.FOV) * (Math.PI / 180);
        this.halfSW = W / 2;
        this.fovFactor = this.halfSW / Math.tan(this.fovInRad / 2);
        this.NEAR = 30;
        this.displayWireFrame = false;
    }

    depthShade(depth) {
        const k = 0.015;      // tweak this
        let s = 255 - depth * k * 255;
        return s < 40 ? 40 : s;
    }

    drawWall(x1, y1Top, y1Bottom, x2, y2Top, y2Bottom, r, g, b) {
        drawLine(x1, y1Top, x1, y1Bottom, r, g, b);
        drawLine(x1, y1Bottom, x2, y2Bottom, r, g, b);
        drawLine(x2, y2Bottom, x2, y2Top, r, g, b);
        drawLine(x2, y2Top, x1, y1Top, r, g, b);
    }


    drawWireframe(vertices, r, g, b) {
        if (vertices.length < 2) return;

        for (let i = 0; i < vertices.length; i++) {
            const v1 = vertices[i];
            const v2 = vertices[(i + 1) % vertices.length]; // close the loop

            drawLine(
                R(v1.x),
                R(v1.y),
                R(v2.x),
                R(v2.y),
                r, g, b
            );
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
        // 1. Calculate Bounding Box
        const minX = Math.max(0, Math.floor(Math.min(v0.x, v1.x, v2.x)));
        const maxX = Math.min(W - 1, Math.ceil(Math.max(v0.x, v1.x, v2.x)));
        const minY = Math.max(0, Math.floor(Math.min(v0.y, v1.y, v2.y)));
        const maxY = Math.min(H - 1, Math.ceil(Math.max(v0.y, v1.y, v2.y)));

        if (minX > maxX || minY > maxY) return;

        // 2. Perspective Pre-calc
        v0.invZ = 1 / v0.ry; v1.invZ = 1 / v1.ry; v2.invZ = 1 / v2.ry;
        v0.wxz = v0.wx * v0.invZ; v0.wyz = v0.wy * v0.invZ;
        v1.wxz = v1.wx * v1.invZ; v1.wyz = v1.wy * v1.invZ;
        v2.wxz = v2.wx * v2.invZ; v2.wyz = v2.wy * v2.invZ;

        const area = (v1.x - v0.x) * (v2.y - v0.y) - (v2.x - v0.x) * (v1.y - v0.y);
        if (Math.abs(area) < 0.1) return;
        const invArea = 1 / area;

        // 3. Gradients (how much weights change per pixel step)
        const dw0dx = (v1.y - v2.y) * invArea;
        const dw1dx = (v2.y - v0.y) * invArea;

        const texW = texture.width;
        const texH = texture.height;
        const worldScale = 0.02;
        const eps = -1e-4; // The "Gap Killer"

        for (let y = minY; y <= maxY; y++) {
            // Calculate weights for the start of this row (at minX)
            let w0 = ((v1.x - minX) * (v2.y - y) - (v2.x - minX) * (v1.y - y)) * invArea;
            let w1 = ((v2.x - minX) * (v0.y - y) - (v0.x - minX) * (v2.y - y)) * invArea;

            for (let x = minX; x <= maxX; x++) {
                const w2 = 1 - w0 - w1;

                // Use epsilon to prevent seams between shared edges
                if (w0 >= eps && w1 >= eps && w2 >= eps) {
                    const invZ = w0 * v0.invZ + w1 * v1.invZ + w2 * v2.invZ;
                    const depth = 1 / invZ;

                    // Depth Check
                    if (depth < zBuffer[x]) {
                        const wx = (w0 * v0.wxz + w1 * v1.wxz + w2 * v2.wxz) * depth;
                        const wy = (w0 * v0.wyz + w1 * v1.wyz + w2 * v2.wyz) * depth;

                        // Stable UVs
                        let u = Math.floor(wx * texW * worldScale) % texW;
                        let v = Math.floor(wy * texH * worldScale) % texH;
                        if (u < 0) u += texW;
                        if (v < 0) v += texH;

                        const i = (v * texW + u) * 4;
                        putPixelZ(x, y, depth,
                            texture.data[i],
                            texture.data[i + 1],
                            texture.data[i + 2]
                        );
                    }
                }
                // Step horizontally
                w0 += dw0dx;
                w1 += dw1dx;
            }
        }
    }

    projectWall(l) {
        const eyeHeightInWorld = p.currentSector.fh + p.eyeLevel;
        const currentSector = l.sector;
        const fh = currentSector.fh;
        const ch = currentSector.ch;

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

        if (ry1 <= this.NEAR && ry2 <= this.NEAR) return;
        if (ry1 < this.NEAR) ry1 = this.NEAR;
        if (ry2 < this.NEAR) ry2 = this.NEAR;

        let sx1 = (rx1 * this.fovFactor) / ry1;
        let sx2 = (rx2 * this.fovFactor) / ry2;

        let screenX1 = (this.halfSW + sx1);
        let screenX2 = (this.halfSW + sx2);

        let projH1 = ((ch + eyeHeightInWorld) * this.fovFactor) / ry1;
        let projH2 = ((ch + eyeHeightInWorld) * this.fovFactor) / ry2;

        let sy1T = ((H / 2) - (projH1 / 2));
        let sy2T = ((H / 2) - (projH2 / 2));

        let screenY1 = ((H / 2) + ((fh - eyeHeightInWorld) * this.fovFactor) / ry1);
        let screenY2 = ((H / 2) + ((fh - eyeHeightInWorld) * this.fovFactor) / ry2);

        return ({
            wall: l,
            screenX1, screenX2,
            sy1T, sy2T,
            screenY1, screenY2,
            ry1, ry2
        });
    }

    projectSectorEdge(l, sector) {
        const eyeHeightInWorld = p.currentSector.fh + p.eyeLevel;
        const fh = sector.fh;
        const ch = sector.ch;

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

        let wx1 = l.x1, wy1 = l.y1;
        let wx2 = l.x2, wy2 = l.y2;

        if (ry1 < this.NEAR) ry1 = this.NEAR;
        if (ry2 < this.NEAR) ry2 = this.NEAR;

        let sx1 = (rx1 * this.fovFactor) / ry1;
        let sx2 = (rx2 * this.fovFactor) / ry2;

        let screenX1 = (this.halfSW + sx1);
        let screenX2 = (this.halfSW + sx2);

        let projH1 = ((ch + eyeHeightInWorld) * this.fovFactor) / ry1;
        let projH2 = ((ch + eyeHeightInWorld) * this.fovFactor) / ry2;

        let sy1T = ((H / 2) - (projH1 / 2));
        let sy2T = ((H / 2) - (projH2 / 2));

        let screenY1 = ((H / 2) + ((fh - eyeHeightInWorld) * this.fovFactor) / ry1);
        let screenY2 = ((H / 2) + ((fh - eyeHeightInWorld) * this.fovFactor) / ry2);

        return {
            screenX1, screenX2,
            sy1T, sy2T,
            screenY1, screenY2,
            ry1, ry2,
            wx1, wy1, wx2, wy2,
            fh, ch
        };
    }

    drawSky() {
        if (!SKY_TEX) return;

        const skyW = SKY_TEX.width;
        const skyH = SKY_TEX.height;

        for (let y = 0; y < H; y++) {
            // vertical mapping across full screen
            const ty = Math.floor((y / H) * skyH);

            for (let x = 0; x < W; x++) {
                // map directly across the full width of the texture
                const tx = Math.floor((x / W) * skyW);

                const src = (ty * skyW + tx) * 4;

                putPixel(
                    x,
                    y,
                    SKY_TEX.data[src],
                    SKY_TEX.data[src + 1],
                    SKY_TEX.data[src + 2]
                );
            }
        }
    }


    drawGun(scale = 0.2) {
        if (!GUN_TEX) return;

        const gunW = Math.floor(GUN_TEX.width * scale);
        const gunH = Math.floor(GUN_TEX.height * scale);

        // bottom-center position
        const startX = Math.floor((W - gunW) / 2);
        const startY = H - gunH;

        for (let y = 0; y < gunH; y++) {
            // map to source texture
            const srcY = Math.floor(y / scale);
            for (let x = 0; x < gunW; x++) {
                const srcX = Math.floor(x / scale);
                const src = (srcY * GUN_TEX.width + srcX) * 4;

                const r = GUN_TEX.data[src];
                const g = GUN_TEX.data[src + 1];
                const b = GUN_TEX.data[src + 2];
                const a = GUN_TEX.data[src + 3]; // transparency

                if (a > 0) {
                    putPixel(startX + x, startY + y, r, g, b);
                }
            }
        }
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

        const topDiff = y2Top - y1Top;
        const bottomDiff = y2Bottom - y1Bottom;
        const ryDiff = ry2 - ry1;
        const izDiff = iz2 - iz1;
        const uDiff = u2 - u1;

        const texWidth = texture.width;
        const texHeight = texture.height;
        const data = texture.data;

        // fixed-point scale for inner loop
        const FP_SHIFT = 16;
        const FP_ONE = 1 << FP_SHIFT;

        for (let x = x1; x <= x2; x++) {
            const t = (x - x1) / dx;

            const currentIZ = iz1 + izDiff * t;
            const currentUZ = u1 + uDiff * t;

            let texX = ((currentUZ / currentIZ) | 0);
            if (texX >= texWidth) texX -= texWidth;

            const top = y1Top + topDiff * t;
            const bottom = y1Bottom + bottomDiff * t;

            if (bottom <= top) continue;

            const depth = ry1 + ryDiff * t;
            if (!isPortal) {
                if (depth >= zBuffer[x]) continue;
                zBuffer[x] = depth;
            }

            const colHeight = bottom - top;
            const vStepFP = (texHeight * FP_ONE) / colHeight;
            let vFP = 0;

            const ry = 1 / currentIZ;
            const shade = 255 - ry * 0.15;

            const yStart = Math.floor(top);
            const yEnd = Math.ceil(bottom);

            const texWidthMinus1 = texWidth - 1;
            const texHeightMinus1 = texHeight - 1;

            for (let y = yStart; y < yEnd; y++, vFP += vStepFP) {
                // fixed-point texY
                let texY = (vFP >> FP_SHIFT);
                if (texY > texHeightMinus1) texY = texHeightMinus1;

                const i = (texY * texWidth + texX) << 2; // multiply by 4

                if (!(isPortal && depth >= zBuffer[x])) {
                    const r = (data[i] * shade) >> 8;
                    const g = (data[i + 1] * shade) >> 8;
                    const b = (data[i + 2] * shade) >> 8;

                    putPixelZ(x, y, depth, r, g, b);
                }
            }
        }
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
                        // this.drawWall(R(w.screenX1), R(neighFloor1), R(curFloor1), R(w.screenX2), R(neighFloor2), R(curFloor2), 255, 0, 0);
                        this.drawTexturedWall(R(w.screenX1), R(neighFloor1), R(curFloor1), R(w.screenX2), R(neighFloor2), R(curFloor2), l.texture, w.ry1, w.ry2, true);
                    }
                    if (nCh > ch) {
                        // this.drawWall(R(w.screenX1), R(neighCeil1), R(curCeil1), R(w.screenX2), R(neighCeil2), R(curCeil2), 255, 0, 0);
                        this.drawTexturedWall(R(w.screenX1), R(neighCeil1), R(curCeil1), R(w.screenX2), R(neighCeil2), R(curCeil2), l.texture, w.ry1, w.ry2, true);

                    }

                } else {
                    if (!l.ghost) {
                        // this.drawWall(R(w.screenX1), R(w.sy1T), R(w.screenY1), R(w.screenX2), R(w.sy2T), R(w.screenY2), 255, 0, 0);
                        this.drawTexturedWall(R(w.screenX1), R(w.sy1T), R(w.screenY1), R(w.screenX2), R(w.sy2T), R(w.screenY2), l.texture, w.ry1, w.ry2);
                    }
                }
            }

            if (this.displayWireFrame) {
                this.drawWireframe(floorVert, 0, 0, 255);
            } else {
                this.fillPolygonTextured(floorVert, s.fTexture);

            }


            if (this.displayWireFrame) {
                this.drawWireframe(ceilingVert, 0, 255, 0);
            } else {
                this.fillPolygonTextured(ceilingVert, s.cTexture);

            }

        }
    }
}


let project3D = new Project3D();

let mcx;
let mcy;

c.addEventListener('mousemove', (e) => {
    const rect = c.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    const cx = Math.floor(mx / SCALE);
    const cy = Math.floor(my / SCALE);

    if (cx < 0 || cx >= W || cy < 0 || cy >= H) return;

    mcx = cx;
    mcy = cy;
});

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
        project3D.drawSky();
        project3D.project();
        project3D.drawGun();
        map.forEach(l => l.checkIsVisible());
    }
}

const render = (currentTime) => {
    pixels.fill(0)

    update();

    bctx.putImageData(imageData, 0, 0);

    ctx.clearRect(0, 0, c.width, c.height);
    ctx.drawImage(buffer, 0, 0, R(W * SCALE), R(H * SCALE));


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

    // writeUI();

    if (!is3D) {
        map.forEach((l) => {
            // writeCoord(l.ox1, l.oy1, l.x1, l.y1);
            // writeCoord(l.ox2, l.oy2, l.x2, l.y2);
        });
    }

    // writeCoord(mcx, mcy, mcx, mcy);
};

function engine(currentTime) {

    render(currentTime);
    requestAnimationFrame(engine);
}

requestAnimationFrame(engine);  