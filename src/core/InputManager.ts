export class InputManager {
  private keys = new Set<string>();
  private justPressedKeys = new Set<string>();
  private rightDown = false;
  private leftJustClicked = false;
  private dragDX = 0;
  private dragDY = 0;
  private wheelDelta = 0;

  constructor(private domElement: HTMLElement) {
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    domElement.addEventListener('mousedown', this.onMouseDown);
    window.addEventListener('mouseup', this.onMouseUp);
    window.addEventListener('mousemove', this.onMouseMove);
    domElement.addEventListener('wheel', this.onWheel, { passive: true });
    domElement.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  private static readonly GAME_KEYS = new Set([
    'KeyW',
    'KeyA',
    'KeyS',
    'KeyD',
    'ArrowUp',
    'ArrowDown',
    'ArrowLeft',
    'ArrowRight',
    'KeyQ',
    'KeyE',
    'KeyR',
    'Space',
    'Digit1',
    'Digit2',
    'Digit3',
    'ShiftLeft',
    'ShiftRight',
    'F1',
    'KeyG',
  ]);

  private onKeyDown = (e: KeyboardEvent) => {
    const code = e.code;
    if (InputManager.GAME_KEYS.has(code)) e.preventDefault();
    if (!this.keys.has(code)) this.justPressedKeys.add(code);
    this.keys.add(code);
  };

  private onKeyUp = (e: KeyboardEvent) => {
    this.keys.delete(e.code);
  };

  private onMouseDown = (e: MouseEvent) => {
    if (e.button === 2) this.rightDown = true;
    if (e.button === 0) this.leftJustClicked = true;
  };

  private onMouseUp = (e: MouseEvent) => {
    if (e.button === 2) this.rightDown = false;
  };

  private onMouseMove = (e: MouseEvent) => {
    if (this.rightDown) {
      this.dragDX += e.movementX;
      this.dragDY += e.movementY;
    }
  };

  private onWheel = (e: WheelEvent) => {
    this.wheelDelta += e.deltaY;
  };

  isDown(code: string): boolean {
    return this.keys.has(code);
  }

  wasJustPressed(code: string): boolean {
    return this.justPressedKeys.has(code);
  }

  consumeLeftClick(): boolean {
    const v = this.leftJustClicked;
    this.leftJustClicked = false;
    return v;
  }

  consumeDrag(): { dx: number; dy: number } {
    const v = { dx: this.dragDX, dy: this.dragDY };
    this.dragDX = 0;
    this.dragDY = 0;
    return v;
  }

  consumeWheel(): number {
    const v = this.wheelDelta;
    this.wheelDelta = 0;
    return v;
  }

  isRightDown(): boolean {
    return this.rightDown;
  }

  /** Call once per frame after game logic has read justPressed keys. */
  endFrame() {
    this.justPressedKeys.clear();
  }

  getMovementAxis(): { x: number; z: number } {
    let x = 0;
    let z = 0;
    if (this.isDown('KeyW') || this.isDown('ArrowUp')) z -= 1;
    if (this.isDown('KeyS') || this.isDown('ArrowDown')) z += 1;
    if (this.isDown('KeyA') || this.isDown('ArrowLeft')) x -= 1;
    if (this.isDown('KeyD') || this.isDown('ArrowRight')) x += 1;
    return { x, z };
  }
}
