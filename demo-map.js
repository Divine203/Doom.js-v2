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