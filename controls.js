


const controls = () => {
    document.addEventListener('keydown', (e) => {
        switch (e.key) {
            case 'ArrowUp':
                if (!K.d) K.u = true;
                break;
            case 'ArrowLeft':
                if (!K.r) K.l = true;
                break;
            case 'ArrowRight':
                if (!K.l) K.r = true;
                break;
            case 'ArrowDown':
                if (!K.u) K.d = true;
                break;

            case 'w':
                if (!K.S) K.W = true;
                break;
            case 'a':
                if (!K.D) K.A = true;
                break;
            case 's':
                if (!K.W) K.S = true;
                break;
            case 'd':
                if (!K.A) K.D = true;
                break;
            case 'q':
                if (!K.E) K.Q = true;
                break;
            case 'e':
                if (!K.Q) K.E = true;
                is3D = !is3D;

                SCALE = is3D ? 2 : 1;
                W = c.width / SCALE;
                H = c.height / SCALE;
                buffer.width = W;
                buffer.height = H;

                bctx = buffer.getContext('2d');

                imageData = bctx.createImageData(W, H);
                pixels = imageData.data;

                zBuffer = new Float32Array(W * H);
                
                project3D = new Project3D();
                break;
        }
    });

    document.addEventListener('keyup', (e) => {
        switch (e.key) {
            case 'ArrowUp':
                K.u = false;
                break;
            case 'ArrowLeft':
                K.l = false;
                break;
            case 'ArrowRight':
                K.r = false;
                break;
            case 'ArrowDown':
                K.d = false;
                break;

            case 'w':
                K.W = false;
                break;
            case 'a':
                K.A = false;
                break;
            case 's':
                K.S = false;
                break;
            case 'd':
                K.D = false;
                break;
            case 'q':
                K.Q = false;
                break;
            case 'e':
                K.E = false;
                break;
        }
    });
}

controls();
