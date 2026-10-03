/**
 * ArcadeSprites.ts
 * Authentic 16-bit Cozy RPG pixel character sprites and animations for BountyMesh HTML5 Canvas.
 * Art style: Cozy 16-Bit RPG (Stardew Valley / Chrono Trigger / Zelda A Link to the Past).
 * Warm, earthy, well-shaded palettes with zero unicode emojis.
 */

export type ArcadeAvatarType = "questor" | "claude" | "gemini" | "specialist" | "sentinel";
export type ArcadeFacing = "left" | "right" | "down" | "up";
export type ArcadeState = "idle" | "walking" | "bidding" | "working" | "celebrating" | "rejected";

export interface ArcadeCharacter {
  id: string;
  name: string;
  role: "questor" | "orchestrator" | "worker";
  model: string;
  color: string;
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  facing: ArcadeFacing;
  state: ArcadeState;
  dialogue: string | null;
  dialogueColor?: string;
  bidSimilarity?: number;
  avatarType: ArcadeAvatarType;
  level: number;
  gold: number;
  accountRegistered?: boolean;
  skills: string[];
  // Autonomous idle and navigation properties
  idleStationId?: string;
  idlePauseTimer?: number;
  dialogueTimer?: number;
  chatCooldownTimer?: number;
  homeX?: number;
  homeY?: number;
  wanderWaypoint?: { x: number; y: number } | null;
  lastPosX?: number;
  lastPosY?: number;
  stuckTimer?: number;
}

export interface ArcadeDrawOptions {
  showNameplate?: boolean;
  showBalance?: boolean;
  showShadow?: boolean;
  pixelScale?: number;
}

// ---------------------------------------------------------------------------
// Low-level Pixel Drawing Primitives
// ---------------------------------------------------------------------------

function drawPixel(
  ctx: CanvasRenderingContext2D,
  px: number,
  py: number,
  color: string,
  scale: number
): void {
  ctx.fillStyle = color;
  ctx.fillRect(Math.round(px * scale), Math.round(py * scale), scale, scale);
}

function drawPixelRect(
  ctx: CanvasRenderingContext2D,
  px: number,
  py: number,
  pw: number,
  ph: number,
  color: string,
  scale: number
): void {
  ctx.fillStyle = color;
  ctx.fillRect(
    Math.round(px * scale),
    Math.round(py * scale),
    Math.round(pw * scale),
    Math.round(ph * scale)
  );
}

// ---------------------------------------------------------------------------
// Cozy Pixel Star Drawing Helper (No Emojis)
// ---------------------------------------------------------------------------

export function drawPixelStar(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  size = 6,
  color = "#ffd700"
): void {
  ctx.save();
  ctx.translate(Math.round(cx), Math.round(cy));

  const half = Math.max(2, Math.round(size / 2));
  const inner = Math.max(1, Math.round(size / 3));

  // Outer rays
  ctx.fillStyle = color;
  ctx.fillRect(-half, -1, half * 2 + 1, 3);
  ctx.fillRect(-1, -half, 3, half * 2 + 1);

  // Diagonal pixel sparks
  ctx.fillRect(-inner, -inner, 1, 1);
  ctx.fillRect(inner, -inner, 1, 1);
  ctx.fillRect(-inner, inner, 1, 1);
  ctx.fillRect(inner, inner, 1, 1);

  // Bright core
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(-1, -1, 3, 3);

  ctx.restore();
}

// ---------------------------------------------------------------------------
// Cozy Pixel Exclamation Mark Helper (No Emojis)
// ---------------------------------------------------------------------------

export function drawPixelExclamation(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  color = "#facc15"
): void {
  ctx.save();
  ctx.translate(Math.round(cx), Math.round(cy));

  // Small parchment badge backing
  ctx.fillStyle = "#261910";
  ctx.fillRect(-4, -12, 9, 15);
  ctx.fillStyle = "#5c3d26";
  ctx.strokeRect(-4, -12, 9, 15);

  // Upper bar
  ctx.fillStyle = color;
  ctx.fillRect(-1, -10, 3, 6);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(-1, -10, 1, 5);

  // Lower dot
  ctx.fillStyle = color;
  ctx.fillRect(-1, -2, 3, 3);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(-1, -2, 1, 1);

  ctx.restore();
}

// ---------------------------------------------------------------------------
// Cozy Pixel Cross / Rejection Mark Helper (No Emojis)
// ---------------------------------------------------------------------------

export function drawPixelCross(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  color = "#c96b6b"
): void {
  ctx.save();
  ctx.translate(Math.round(cx), Math.round(cy));

  // Small dark timber backing plate
  ctx.fillStyle = "#261910";
  ctx.fillRect(-5, -5, 11, 11);
  ctx.strokeStyle = "#5c3d26";
  ctx.lineWidth = 1;
  ctx.strokeRect(-5, -5, 11, 11);

  // Pixel cross mark
  ctx.fillStyle = color;
  ctx.fillRect(-3, -3, 2, 2);
  ctx.fillRect(2, -3, 2, 2);
  ctx.fillRect(-2, -2, 2, 2);
  ctx.fillRect(1, -2, 2, 2);
  ctx.fillRect(-1, -1, 3, 3);
  ctx.fillRect(-2, 1, 2, 2);
  ctx.fillRect(1, 1, 2, 2);
  ctx.fillRect(-3, 2, 2, 2);
  ctx.fillRect(2, 2, 2, 2);

  // Bright core highlight
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, 1, 1);

  ctx.restore();
}

// ---------------------------------------------------------------------------
// Cozy Pixel Gold Coin Helper (No Emojis)
// ---------------------------------------------------------------------------

export function drawPixelCoin(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  size = 7
): void {
  ctx.save();
  ctx.translate(Math.round(cx), Math.round(cy));

  // Outer dark gold rim
  ctx.fillStyle = "#8a580a";
  ctx.fillRect(-3, -3, 7, 7);

  // Corner trims for rounded retro coin
  ctx.clearRect(-4, -4, 1, 1);
  ctx.clearRect(4, -4, 1, 1);
  ctx.clearRect(-4, 4, 1, 1);
  ctx.clearRect(4, 4, 1, 1);

  // Inner rich gold
  ctx.fillStyle = "#ffd700";
  ctx.fillRect(-2, -2, 5, 5);

  // Specular gleam
  ctx.fillStyle = "#fffbeb";
  ctx.fillRect(-2, -2, 2, 2);

  // Center coin press mark
  ctx.fillStyle = "#d97706";
  ctx.fillRect(0, -1, 2, 3);

  ctx.restore();
}

// ---------------------------------------------------------------------------
// Unified Compact Nameplate & Balance Tag Renderer (Prevents Overlapping)
// ---------------------------------------------------------------------------

export function drawCharacterBadge(
  ctx: CanvasRenderingContext2D,
  char: ArcadeCharacter
): void {
  const badgeY = Math.round(char.y + 7);
  const name = char.name;
  const showBalance = char.accountRegistered === true;
  const balStr = `$${(char.gold / 100).toFixed(2)}`;

  ctx.save();
  ctx.font = "600 11px 'DM Sans', -apple-system, sans-serif";
  const nameW = ctx.measureText(name).width;

  ctx.font = "700 10px 'JetBrains Mono', monospace";
  const balW = showBalance ? ctx.measureText(balStr).width : 0;

  const padX = 8;
  const gap = 6;
  const coinSize = 8;
  const balanceW = showBalance ? gap + coinSize + 3 + balW : 0;
  const totalW = Math.round(padX * 2 + nameW + balanceW);
  const badgeH = 18;
  const badgeX = Math.round(char.x - totalW / 2);

  // Single sleek warm walnut badge backing with soft shadow
  ctx.fillStyle = "rgba(22, 16, 12, 0.92)";
  ctx.beginPath();
  if (typeof ctx.roundRect === "function") {
    ctx.roundRect(badgeX, badgeY, totalW, badgeH, 4);
  } else {
    ctx.rect(badgeX, badgeY, totalW, badgeH);
  }
  ctx.fill();

  // Subtle border matching character accent
  ctx.strokeStyle = char.color || "rgba(212, 184, 106, 0.6)";
  ctx.lineWidth = 1;
  ctx.stroke();

  // Character Name Text
  ctx.font = "600 11px 'DM Sans', -apple-system, sans-serif";
  ctx.fillStyle = "#fdfbf7";
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillText(name, badgeX + padX, badgeY + badgeH / 2);

  if (showBalance) {
      // Neutral divider dot
      const divX = badgeX + padX + nameW + gap / 2;
      ctx.fillStyle = "#6d5b4b";
      ctx.beginPath();
      ctx.arc(divX, badgeY + badgeH / 2, 1.5, 0, Math.PI * 2);
      ctx.fill();

      // Pixel gold coin icon
      const coinX = divX + gap / 2 + coinSize / 2;
      drawPixelCoin(ctx, coinX, badgeY + badgeH / 2 - 1, coinSize);

      // Balance text
      ctx.font = "700 10px 'JetBrains Mono', monospace";
      ctx.fillStyle = "#d4b86a";
      ctx.fillText(balStr, coinX + coinSize / 2 + 3, badgeY + badgeH / 2);

  }
  ctx.restore();
}

export function drawCharacterNameplate(
  ctx: CanvasRenderingContext2D,
  char: ArcadeCharacter
): void {
  drawCharacterBadge(ctx, char);
}

export function drawCharacterBalanceTag(
  ctx: CanvasRenderingContext2D,
  char: ArcadeCharacter
): void {
  // Maintained for backward compatibility; integrated into drawCharacterBadge
  void ctx;
  void char;
}

// ---------------------------------------------------------------------------
// Character 1: QUESTOR (Traveler / Client)
// Brown traveler cloak, gold clasp, linen tunic, leather belt & coin pouch,
// sturdy traveler boots, distinctive feathered cap, directional facing & walk.
// ---------------------------------------------------------------------------

function drawQuestor(
  ctx: CanvasRenderingContext2D,
  char: ArcadeCharacter,
  ticks: number,
  scale: number,
  facing: ArcadeFacing,
  isWalking: boolean,
  walkCycle: number,
  isCelebrating: boolean
): void {
  // Palettes
  const C_CLOAK_LIGHT = "#8c5d37";
  const C_CLOAK_MAIN = "#613e21";
  const C_CLOAK_SHADOW = "#3d2613";
  const C_CLASP_LIGHT = "#fff4b8";
  const C_CLASP_MAIN = "#ffd700";
  const C_CLASP_SHADOW = "#b48209";
  const C_TUNIC_LIGHT = "#f4efe4";
  const C_TUNIC_MAIN = "#d7cbb5";
  const C_TUNIC_SHADOW = "#9e9178";
  const C_LEATHER_MAIN = "#482b17";
  const C_LEATHER_DARK = "#2a170b";
  const C_POUCH_MAIN = "#b87c42";
  const C_POUCH_SHADOW = "#754920";
  const C_GOLD = "#ffd700";
  const C_SKIN_LIGHT = "#fde3ce";
  const C_SKIN_MAIN = "#f7be96";
  const C_SKIN_SHADOW = "#cc885f";
  const C_HAIR = "#422512";
  const C_EYE = "#1c1108";
  const C_CAP_MAIN = "#2d563a";
  const C_CAP_LIGHT = "#417852";
  const C_CAP_DARK = "#1a3623";
  const C_FEATHER_LIGHT = "#ffffff";
  const C_FEATHER_MAIN = "#fef08a";
  const C_FEATHER_TIP = "#eab308";

  // Leg offsets
  const leftLegOffset = isWalking ? Math.round(Math.sin(walkCycle) * 2.5) : 0;
  const rightLegOffset = isWalking ? Math.round(-Math.sin(walkCycle) * 2.5) : 0;
  const armOffset = isWalking ? Math.round(-Math.sin(walkCycle) * 2.0) : 0;

  if (facing === "down") {
    // Front View

    // 1. Cloak backdrop
    drawPixelRect(ctx, -6, -13, 13, 11, C_CLOAK_SHADOW, scale);

    // 2. Legs / Boots
    const leftBootY = isWalking && leftLegOffset < 0 ? -1 : 0;
    const rightBootY = isWalking && rightLegOffset < 0 ? -1 : 0;
    // Left leg
    drawPixelRect(ctx, -4, -6 + leftBootY, 3, 4, C_LEATHER_MAIN, scale);
    drawPixelRect(ctx, -4, -2 + leftBootY, 3, 2, C_LEATHER_DARK, scale);
    // Right leg
    drawPixelRect(ctx, 2, -6 + rightBootY, 3, 4, C_LEATHER_MAIN, scale);
    drawPixelRect(ctx, 2, -2 + rightBootY, 3, 2, C_LEATHER_DARK, scale);

    // 3. Linen Tunic
    drawPixelRect(ctx, -3, -13, 7, 6, C_TUNIC_MAIN, scale);
    drawPixelRect(ctx, -2, -13, 5, 2, C_TUNIC_LIGHT, scale);
    drawPixelRect(ctx, 0, -11, 1, 3, C_TUNIC_SHADOW, scale); // Stitch seam

    // 4. Cloak front folds & Golden Clasp
    drawPixelRect(ctx, -6, -13, 3, 9, C_CLOAK_MAIN, scale);
    drawPixelRect(ctx, 4, -13, 3, 9, C_CLOAK_MAIN, scale);
    drawPixelRect(ctx, -6, -13, 1, 8, C_CLOAK_LIGHT, scale);
    drawPixelRect(ctx, 6, -13, 1, 8, C_CLOAK_SHADOW, scale);

    // Golden Clasp at throat
    drawPixelRect(ctx, -1, -13, 3, 2, C_CLASP_MAIN, scale);
    drawPixel(ctx, 0, -13, C_CLASP_LIGHT, scale);
    drawPixel(ctx, -1, -12, C_CLASP_SHADOW, scale);

    // 5. Leather Belt & Coin Pouch
    drawPixelRect(ctx, -4, -8, 9, 2, C_LEATHER_MAIN, scale);
    drawPixel(ctx, 0, -8, C_CLASP_MAIN, scale); // Buckle
    // Coin pouch at hip
    drawPixelRect(ctx, 3, -8, 3, 3, C_POUCH_MAIN, scale);
    drawPixel(ctx, 4, -9, C_LEATHER_DARK, scale); // Tie string
    drawPixel(ctx, 4, -7, C_GOLD, scale); // Gold glint

    // 6. Arms / Hands
    if (isCelebrating) {
      // Arms raised
      drawPixelRect(ctx, -7, -19, 2, 7, C_CLOAK_MAIN, scale);
      drawPixelRect(ctx, 6, -19, 2, 7, C_CLOAK_MAIN, scale);
      drawPixelRect(ctx, -7, -21, 2, 2, C_SKIN_MAIN, scale);
      drawPixelRect(ctx, 6, -21, 2, 2, C_SKIN_MAIN, scale);
    } else {
      drawPixelRect(ctx, -7, -12 + armOffset, 2, 6, C_CLOAK_MAIN, scale);
      drawPixelRect(ctx, -7, -6 + armOffset, 2, 2, C_SKIN_MAIN, scale);
      drawPixelRect(ctx, 6, -12 - armOffset, 2, 6, C_CLOAK_MAIN, scale);
      drawPixelRect(ctx, 6, -6 - armOffset, 2, 2, C_SKIN_MAIN, scale);
    }

    // 7. Head & Face
    drawPixelRect(ctx, -3, -19, 7, 6, C_SKIN_MAIN, scale);
    drawPixelRect(ctx, -2, -19, 5, 2, C_SKIN_LIGHT, scale);
    // Hair framing
    drawPixelRect(ctx, -4, -18, 1, 4, C_HAIR, scale);
    drawPixelRect(ctx, 4, -18, 1, 4, C_HAIR, scale);
    // Eyes
    drawPixel(ctx, -2, -17, C_EYE, scale);
    drawPixel(ctx, 2, -17, C_EYE, scale);
    drawPixel(ctx, -2, -18, "#ffffff", scale); // Eye shine
    drawPixel(ctx, 2, -18, "#ffffff", scale);
    // Warm mouth
    drawPixel(ctx, 0, -15, C_SKIN_SHADOW, scale);

    // 8. Distinctive Feathered Traveler Cap
    // Cap brim
    drawPixelRect(ctx, -5, -20, 11, 2, C_CAP_DARK, scale);
    drawPixelRect(ctx, -4, -20, 9, 1, C_CAP_MAIN, scale);
    // Cap crown
    drawPixelRect(ctx, -4, -23, 9, 3, C_CAP_MAIN, scale);
    drawPixelRect(ctx, -3, -24, 7, 1, C_CAP_LIGHT, scale);
    // Cap band
    drawPixelRect(ctx, -4, -21, 9, 1, C_LEATHER_DARK, scale);
    drawPixel(ctx, 0, -21, C_CLASP_MAIN, scale);
    // Sweeping Feather
    drawPixel(ctx, 2, -22, C_FEATHER_TIP, scale);
    drawPixel(ctx, 3, -23, C_FEATHER_MAIN, scale);
    drawPixel(ctx, 4, -24, C_FEATHER_LIGHT, scale);
    drawPixel(ctx, 5, -25, C_FEATHER_LIGHT, scale);
    drawPixel(ctx, 6, -26, C_FEATHER_LIGHT, scale);
    drawPixel(ctx, 5, -24, C_FEATHER_MAIN, scale);
  } else if (facing === "up") {
    // Back View (Facing North / Away from camera)
    // 1. Full cloak back
    drawPixelRect(ctx, -6, -13, 13, 11, C_CLOAK_MAIN, scale);
    drawPixelRect(ctx, -7, -3, 15, 3, C_CLOAK_SHADOW, scale);
    drawPixelRect(ctx, -2, -13, 1, 10, C_CLOAK_SHADOW, scale);
    drawPixelRect(ctx, 2, -13, 1, 10, C_CLOAK_SHADOW, scale);
    drawPixelRect(ctx, -5, -13, 1, 9, C_CLOAK_LIGHT, scale);

    // 2. Legs / Boots from behind
    const leftBootY = isWalking && leftLegOffset < 0 ? -1 : 0;
    const rightBootY = isWalking && rightLegOffset < 0 ? -1 : 0;
    drawPixelRect(ctx, -4, -6 + leftBootY, 3, 4, C_LEATHER_MAIN, scale);
    drawPixelRect(ctx, -4, -2 + leftBootY, 3, 2, C_LEATHER_DARK, scale);
    drawPixelRect(ctx, 2, -6 + rightBootY, 3, 4, C_LEATHER_MAIN, scale);
    drawPixelRect(ctx, 2, -2 + rightBootY, 3, 2, C_LEATHER_DARK, scale);

    // 3. Arms
    if (isCelebrating) {
      drawPixelRect(ctx, -7, -19, 2, 7, C_CLOAK_MAIN, scale);
      drawPixelRect(ctx, 6, -19, 2, 7, C_CLOAK_MAIN, scale);
      drawPixelRect(ctx, -7, -21, 2, 2, C_SKIN_MAIN, scale);
      drawPixelRect(ctx, 6, -21, 2, 2, C_SKIN_MAIN, scale);
    } else {
      drawPixelRect(ctx, -7, -12 + armOffset, 2, 6, C_CLOAK_MAIN, scale);
      drawPixelRect(ctx, 6, -12 - armOffset, 2, 6, C_CLOAK_MAIN, scale);
    }

    // 4. Back of head & hair at nape
    drawPixelRect(ctx, -4, -18, 9, 5, C_HAIR, scale);

    // 5. Feathered traveler cap from behind
    drawPixelRect(ctx, -5, -20, 11, 2, C_CAP_DARK, scale);
    drawPixelRect(ctx, -4, -23, 9, 3, C_CAP_MAIN, scale);
    drawPixelRect(ctx, -3, -24, 7, 1, C_CAP_LIGHT, scale);
    drawPixel(ctx, 2, -22, C_FEATHER_TIP, scale);
    drawPixel(ctx, 3, -23, C_FEATHER_MAIN, scale);
    drawPixel(ctx, 4, -24, C_FEATHER_LIGHT, scale);
    drawPixel(ctx, 5, -25, C_FEATHER_LIGHT, scale);
  } else {
    // Side View (facing left or right)
    // 1. Cloak flowing behind
    drawPixelRect(ctx, -6, -13, 4, 11, C_CLOAK_SHADOW, scale);
    drawPixelRect(ctx, -5, -12, 3, 9, C_CLOAK_MAIN, scale);

    // 2. Legs / Boots in walk stride
    const backBootX = -2 - leftLegOffset;
    const frontBootX = 1 + leftLegOffset;
    drawPixelRect(ctx, backBootX, -6, 3, 4, C_LEATHER_MAIN, scale);
    drawPixelRect(ctx, backBootX, -2, 3, 2, C_LEATHER_DARK, scale);
    drawPixelRect(ctx, frontBootX, -6, 3, 4, C_LEATHER_MAIN, scale);
    drawPixelRect(ctx, frontBootX, -2, 3, 2, C_LEATHER_DARK, scale);

    // 3. Tunic & Cloak
    drawPixelRect(ctx, -2, -13, 5, 6, C_TUNIC_MAIN, scale);
    drawPixelRect(ctx, 0, -13, 3, 5, C_TUNIC_LIGHT, scale);
    drawPixelRect(ctx, -3, -13, 3, 8, C_CLOAK_MAIN, scale);

    // Gold Clasp on shoulder
    drawPixelRect(ctx, 1, -13, 2, 2, C_CLASP_MAIN, scale);
    drawPixel(ctx, 2, -13, C_CLASP_LIGHT, scale);

    // 4. Belt & Coin Pouch on hip
    drawPixelRect(ctx, -2, -8, 6, 2, C_LEATHER_MAIN, scale);
    drawPixelRect(ctx, 1, -8, 3, 3, C_POUCH_MAIN, scale);
    drawPixel(ctx, 2, -7, C_GOLD, scale);

    // 5. Arm & Walking stick / Cane
    if (isCelebrating) {
      drawPixelRect(ctx, 0, -20, 2, 8, C_CLOAK_MAIN, scale);
      drawPixelRect(ctx, 0, -22, 2, 2, C_SKIN_MAIN, scale);
    } else {
      drawPixelRect(ctx, 0 + armOffset, -12, 2, 6, C_CLOAK_MAIN, scale);
      drawPixelRect(ctx, 0 + armOffset, -6, 2, 2, C_SKIN_MAIN, scale);
      // Walking cane
      drawPixelRect(ctx, 3 + armOffset, -9, 1, 9, "#3a2010", scale);
      drawPixel(ctx, 3 + armOffset, -10, C_CLASP_MAIN, scale);
    }

    // 6. Head in profile
    drawPixelRect(ctx, -1, -19, 5, 6, C_SKIN_MAIN, scale);
    drawPixelRect(ctx, 1, -19, 3, 2, C_SKIN_LIGHT, scale);
    drawPixelRect(ctx, -3, -18, 2, 4, C_HAIR, scale);
    // Profile Eye
    drawPixel(ctx, 2, -17, C_EYE, scale);
    drawPixel(ctx, 2, -18, "#ffffff", scale);
    // Nose bridge
    drawPixel(ctx, 4, -16, C_SKIN_SHADOW, scale);

    // 7. Cap in profile with trailing feather
    drawPixelRect(ctx, -4, -20, 9, 2, C_CAP_DARK, scale);
    drawPixelRect(ctx, -3, -20, 8, 1, C_CAP_MAIN, scale);
    drawPixelRect(ctx, -3, -23, 7, 3, C_CAP_MAIN, scale);
    drawPixelRect(ctx, -2, -24, 5, 1, C_CAP_LIGHT, scale);
    // Feather trailing back
    drawPixel(ctx, -2, -22, C_FEATHER_TIP, scale);
    drawPixel(ctx, -4, -23, C_FEATHER_MAIN, scale);
    drawPixel(ctx, -6, -24, C_FEATHER_LIGHT, scale);
    drawPixel(ctx, -8, -25, C_FEATHER_LIGHT, scale);
  }
}

// ---------------------------------------------------------------------------
// Character 2: CLAUDE (Guildmaster / Orchestrator)
// Rich purple and gold-trimmed wizard robe, cowl/hood with silver hair or beard,
// carrying an arcane wooden staff topped with a glowing sapphire focus gem.
// Breathing / bobbing idle animation.
// ---------------------------------------------------------------------------

function drawClaude(
  ctx: CanvasRenderingContext2D,
  char: ArcadeCharacter,
  ticks: number,
  scale: number,
  facing: ArcadeFacing,
  isWalking: boolean,
  walkCycle: number,
  isCelebrating: boolean
): void {
  // Palettes
  const C_ROBE_LIGHT = "#8762a6";
  const C_ROBE_MAIN = "#5a3a78";
  const C_ROBE_SHADOW = "#391f52";
  const C_ROBE_DEEP = "#221133";
  const C_GOLD_LIGHT = "#fff3a8";
  const C_GOLD_MAIN = "#ffd700";
  const C_GOLD_SHADOW = "#b48209";
  const C_SILVER_LIGHT = "#ffffff";
  const C_SILVER_MAIN = "#e2e8f0";
  const C_SILVER_SHADOW = "#94a3b8";
  const C_WOOD_MAIN = "#4d2e15";
  const C_WOOD_SHADOW = "#2d1808";
  const C_GEM_LIGHT = "#ffffff";
  const C_GEM_CYAN = "#38bdf8";
  const C_GEM_MAIN = "#0284c7";
  const C_GEM_SHADOW = "#0369a1";
  const C_SKIN = "#f5d4be";

  // Arcane sapphire pulse
  const gemGlow = 0.6 + 0.4 * Math.sin(ticks * 0.1);
  const moteFloat = Math.sin(ticks * 0.12) * 2;

  // Walk and idle step calculations
  const legOffset = isWalking ? Math.round(Math.sin(walkCycle) * 2.0) : 0;

  if (facing === "down") {
    // Front View

    // 1. Long wizard robe backdrop & hem
    drawPixelRect(ctx, -6, -14, 13, 13, C_ROBE_MAIN, scale);
    drawPixelRect(ctx, -7, -3, 15, 3, C_ROBE_SHADOW, scale);
    drawPixelRect(ctx, -6, -1, 13, 1, C_ROBE_DEEP, scale);

    // Gold trim running along robe hem
    drawPixelRect(ctx, -6, -2, 13, 1, C_GOLD_MAIN, scale);
    drawPixel(ctx, 0, -2, C_GOLD_LIGHT, scale);

    // Subtle feet peeking under robe hem
    drawPixelRect(ctx, -3 + legOffset, 0, 2, 1, "#18101a", scale);
    drawPixelRect(ctx, 2 - legOffset, 0, 2, 1, "#18101a", scale);

    // 2. Regal Gold Vertical Sash with arcane glyphs
    drawPixelRect(ctx, -1, -12, 3, 11, C_GOLD_MAIN, scale);
    drawPixel(ctx, 0, -11, C_GOLD_LIGHT, scale);
    drawPixel(ctx, 0, -8, C_GOLD_SHADOW, scale);
    drawPixel(ctx, 0, -5, C_GOLD_LIGHT, scale);

    // 3. Wide Wizard Robe Sleeves
    drawPixelRect(ctx, -8, -13, 3, 8, C_ROBE_SHADOW, scale);
    drawPixelRect(ctx, -7, -13, 2, 7, C_ROBE_MAIN, scale);
    drawPixelRect(ctx, 6, -13, 3, 8, C_ROBE_SHADOW, scale);
    drawPixelRect(ctx, 6, -13, 2, 7, C_ROBE_MAIN, scale);
    // Gold trim cuffs
    drawPixelRect(ctx, -8, -6, 3, 1, C_GOLD_MAIN, scale);
    drawPixelRect(ctx, 6, -6, 3, 1, C_GOLD_MAIN, scale);

    // Hands
    drawPixelRect(ctx, -7, -5, 2, 2, C_SKIN, scale);
    drawPixelRect(ctx, 6, -5, 2, 2, C_SKIN, scale);

    // 4. Cowl / Hood (Deep framing)
    drawPixelRect(ctx, -5, -23, 11, 10, C_ROBE_MAIN, scale);
    drawPixelRect(ctx, -4, -24, 9, 2, C_ROBE_LIGHT, scale);
    drawPixelRect(ctx, -2, -26, 5, 2, C_ROBE_MAIN, scale); // Hood tip
    drawPixelRect(ctx, -4, -20, 9, 7, C_ROBE_DEEP, scale); // Deep shadow opening

    // Gold trim border on hood
    drawPixelRect(ctx, -5, -22, 1, 8, C_GOLD_MAIN, scale);
    drawPixelRect(ctx, 5, -22, 1, 8, C_GOLD_MAIN, scale);
    drawPixelRect(ctx, -4, -23, 9, 1, C_GOLD_MAIN, scale);

    // 5. Face & Flowing Silver Beard
    drawPixelRect(ctx, -3, -19, 7, 4, C_SKIN, scale);
    // Wise eyes
    drawPixel(ctx, -2, -18, "#334155", scale);
    drawPixel(ctx, 2, -18, "#334155", scale);
    drawPixel(ctx, -2, -19, C_SILVER_LIGHT, scale); // Silver brows
    drawPixel(ctx, 2, -19, C_SILVER_LIGHT, scale);

    // Magnificent flowing silver beard tapering down over robe
    drawPixelRect(ctx, -3, -16, 7, 4, C_SILVER_MAIN, scale);
    drawPixelRect(ctx, -2, -12, 5, 4, C_SILVER_MAIN, scale);
    drawPixelRect(ctx, -1, -8, 3, 3, C_SILVER_MAIN, scale);
    drawPixel(ctx, 0, -5, C_SILVER_LIGHT, scale); // Beard tip
    // Beard highlights & shadows
    drawPixelRect(ctx, -1, -15, 3, 5, C_SILVER_LIGHT, scale);
    drawPixel(ctx, -3, -14, C_SILVER_SHADOW, scale);
    drawPixel(ctx, 3, -14, C_SILVER_SHADOW, scale);

    // 6. Arcane Wooden Staff with Glowing Sapphire Focus Gem
    // Wooden shaft held in right hand
    const staffX = 8;
    drawPixelRect(ctx, staffX, -22, 2, 23, C_WOOD_MAIN, scale);
    drawPixelRect(ctx, staffX + 1, -22, 1, 23, C_WOOD_SHADOW, scale);

    // Staff head twisted cradle
    drawPixel(ctx, staffX - 1, -23, C_WOOD_MAIN, scale);
    drawPixel(ctx, staffX + 2, -23, C_WOOD_MAIN, scale);
    drawPixel(ctx, staffX - 1, -24, C_WOOD_SHADOW, scale);
    drawPixel(ctx, staffX + 2, -24, C_WOOD_SHADOW, scale);

    // Glowing Sapphire Focus Gem
    const gemX = staffX;
    const gemY = -26;
    drawPixelRect(ctx, gemX - 1, gemY - 1, 4, 4, C_GEM_MAIN, scale);
    drawPixel(ctx, gemX, gemY - 2, C_GEM_CYAN, scale);
    drawPixel(ctx, gemX + 1, gemY - 2, C_GEM_CYAN, scale);
    drawPixel(ctx, gemX, gemY + 2, C_GEM_SHADOW, scale);
    drawPixel(ctx, gemX, gemY, C_GEM_LIGHT, scale); // Gleam core

    // Arcane aura sparkle
    if (gemGlow > 0.7) {
      drawPixel(ctx, gemX - 2, gemY, C_GEM_CYAN, scale);
      drawPixel(ctx, gemX + 3, gemY, C_GEM_CYAN, scale);
      drawPixel(ctx, gemX, gemY - 3, C_GEM_CYAN, scale);
      drawPixel(ctx, gemX + 1, gemY - 3, C_GEM_LIGHT, scale);
    }

    // Floating magical dust mote
    drawPixel(
      ctx,
      gemX - 3,
      Math.round(gemY - 4 + moteFloat),
      C_GEM_CYAN,
      scale
    );
  } else if (facing === "up") {
    // Back View (Facing North / Away from camera)
    // 1. Long wizard robe back
    drawPixelRect(ctx, -6, -14, 13, 13, C_ROBE_MAIN, scale);
    drawPixelRect(ctx, -7, -3, 15, 3, C_ROBE_SHADOW, scale);
    drawPixelRect(ctx, -6, -1, 13, 1, C_ROBE_DEEP, scale);
    drawPixelRect(ctx, -6, -2, 13, 1, C_GOLD_MAIN, scale);
    drawPixelRect(ctx, -2, -14, 1, 12, C_ROBE_SHADOW, scale);
    drawPixelRect(ctx, 2, -14, 1, 12, C_ROBE_SHADOW, scale);

    // Subtle feet peeking under robe hem
    drawPixelRect(ctx, -3 + legOffset, 0, 2, 1, "#18101a", scale);
    drawPixelRect(ctx, 2 - legOffset, 0, 2, 1, "#18101a", scale);

    // 2. Wide wizard robe sleeves
    drawPixelRect(ctx, -8, -13, 3, 8, C_ROBE_SHADOW, scale);
    drawPixelRect(ctx, 6, -13, 3, 8, C_ROBE_SHADOW, scale);

    // 3. Cowl / Hood from behind
    drawPixelRect(ctx, -5, -23, 11, 10, C_ROBE_MAIN, scale);
    drawPixelRect(ctx, -4, -25, 9, 3, C_ROBE_LIGHT, scale);
    drawPixelRect(ctx, -2, -27, 5, 3, C_ROBE_MAIN, scale);
    drawPixel(ctx, 0, -28, C_ROBE_SHADOW, scale);
    // Silver hair peek
    drawPixelRect(ctx, -3, -14, 7, 2, C_SILVER_MAIN, scale);

    // 4. Arcane staff held on right
    const staffX = 7;
    drawPixelRect(ctx, staffX, -22, 2, 23, C_WOOD_MAIN, scale);
    drawPixelRect(ctx, staffX + 1, -22, 1, 23, C_WOOD_SHADOW, scale);
    const gemX = staffX;
    const gemY = -26;
    drawPixelRect(ctx, gemX - 1, gemY - 1, 4, 4, C_GEM_MAIN, scale);
    drawPixel(ctx, gemX, gemY, C_GEM_LIGHT, scale);
    drawPixel(ctx, gemX, gemY - 2, C_GEM_CYAN, scale);
    if (gemGlow > 0.7) {
      drawPixel(ctx, gemX + 2, gemY, C_GEM_CYAN, scale);
    }
  } else {
    // Side View (facing left or right)

    // 1. Wizard robe
    drawPixelRect(ctx, -5, -14, 9, 13, C_ROBE_MAIN, scale);
    drawPixelRect(ctx, -6, -3, 11, 3, C_ROBE_SHADOW, scale);
    drawPixelRect(ctx, -5, -1, 10, 1, C_ROBE_DEEP, scale);
    // Gold trim
    drawPixelRect(ctx, -5, -2, 10, 1, C_GOLD_MAIN, scale);

    // 2. Cowl Hood in profile
    drawPixelRect(ctx, -4, -24, 9, 9, C_ROBE_MAIN, scale);
    drawPixelRect(ctx, -5, -26, 4, 3, C_ROBE_SHADOW, scale); // Hood fold behind
    drawPixelRect(ctx, -3, -24, 7, 2, C_ROBE_LIGHT, scale);
    drawPixelRect(ctx, 3, -22, 1, 7, C_GOLD_MAIN, scale); // Hood edge trim

    // 3. Face & Silver Beard in profile
    drawPixelRect(ctx, 0, -19, 4, 4, C_SKIN, scale);
    drawPixel(ctx, 2, -18, "#334155", scale); // Eye
    drawPixel(ctx, 2, -19, C_SILVER_LIGHT, scale); // Brow

    // Beard flowing forward
    drawPixelRect(ctx, 1, -16, 4, 4, C_SILVER_MAIN, scale);
    drawPixelRect(ctx, 2, -12, 3, 5, C_SILVER_MAIN, scale);
    drawPixel(ctx, 3, -7, C_SILVER_LIGHT, scale);

    // 4. Arm & Staff
    drawPixelRect(ctx, -1, -12, 4, 6, C_ROBE_MAIN, scale);
    drawPixelRect(ctx, 1, -6, 2, 2, C_SKIN, scale);

    // Staff
    const staffX = 5;
    drawPixelRect(ctx, staffX, -22, 2, 23, C_WOOD_MAIN, scale);
    drawPixelRect(ctx, staffX + 1, -22, 1, 23, C_WOOD_SHADOW, scale);

    // Sapphire Gem atop staff
    const gemX = staffX;
    const gemY = -26;
    drawPixelRect(ctx, gemX - 1, gemY - 1, 4, 4, C_GEM_MAIN, scale);
    drawPixel(ctx, gemX, gemY, C_GEM_LIGHT, scale);
    drawPixel(ctx, gemX, gemY - 2, C_GEM_CYAN, scale);
    if (gemGlow > 0.7) {
      drawPixel(ctx, gemX + 2, gemY, C_GEM_CYAN, scale);
    }
  }
}

// ---------------------------------------------------------------------------
// Character 3: GEMINI (Scholar / Worker)
// Teal/blue scholarly coat with brass belt buckle, spectacles,
// leather satchel strap across chest, carrying an open ancient tome or quill.
// ---------------------------------------------------------------------------

function drawGemini(
  ctx: CanvasRenderingContext2D,
  char: ArcadeCharacter,
  ticks: number,
  scale: number,
  facing: ArcadeFacing,
  isWalking: boolean,
  walkCycle: number,
  isCelebrating: boolean
): void {
  // Palettes
  const C_COAT_LIGHT = "#5da1b2";
  const C_COAT_MAIN = "#387687";
  const C_COAT_SHADOW = "#204f5c";
  const C_COAT_DARK = "#122c33";
  const C_BRASS_LIGHT = "#fff3a8";
  const C_BRASS_MAIN = "#eab308";
  const C_BRASS_SHADOW = "#854d0e";
  const C_STRAP = "#6c3e1e";
  const C_SATCHEL = "#8d542a";
  const C_SHIRT = "#f8fafc";
  const C_SKIN = "#fcd5b8";
  const C_HAIR = "#4a2c1b";
  const C_HAIR_LIGHT = "#6e432a";
  const C_PANTS = "#2d3748";
  const C_SHOES = "#1a202c";
  const C_BOOK_COVER = "#6b2121";
  const C_BOOK_PAGE = "#fef3c7";
  const C_BOOK_INK = "#451a03";

  // Leg offsets
  const leftLegOffset = isWalking ? Math.round(Math.sin(walkCycle) * 2.5) : 0;
  const rightLegOffset = isWalking ? Math.round(-Math.sin(walkCycle) * 2.5) : 0;

  if (facing === "down") {
    // Front View

    // 1. Dark trousers & scholar shoes
    const leftBootY = isWalking && leftLegOffset < 0 ? -1 : 0;
    const rightBootY = isWalking && rightLegOffset < 0 ? -1 : 0;
    drawPixelRect(ctx, -4, -6 + leftBootY, 3, 4, C_PANTS, scale);
    drawPixelRect(ctx, -4, -2 + leftBootY, 3, 2, C_SHOES, scale);
    drawPixelRect(ctx, 2, -6 + rightBootY, 3, 4, C_PANTS, scale);
    drawPixelRect(ctx, 2, -2 + rightBootY, 3, 2, C_SHOES, scale);

    // 2. Scholar Frock Coat
    drawPixelRect(ctx, -5, -13, 11, 7, C_COAT_MAIN, scale);
    drawPixelRect(ctx, -5, -6, 11, 2, C_COAT_SHADOW, scale);
    drawPixelRect(ctx, -6, -4, 4, 2, C_COAT_DARK, scale); // Coat tails
    drawPixelRect(ctx, 3, -4, 4, 2, C_COAT_DARK, scale);

    // Crisp high shirt collar
    drawPixelRect(ctx, -2, -14, 5, 2, C_SHIRT, scale);

    // 3. Diagonal Crossbody Leather Satchel Strap & Satchel
    // Strap from right shoulder down to left hip
    drawPixel(ctx, 3, -13, C_STRAP, scale);
    drawPixel(ctx, 2, -12, C_STRAP, scale);
    drawPixel(ctx, 1, -11, C_STRAP, scale);
    drawPixel(ctx, 0, -10, C_STRAP, scale);
    drawPixel(ctx, -1, -9, C_STRAP, scale);
    drawPixel(ctx, -2, -8, C_STRAP, scale);
    drawPixel(ctx, -3, -7, C_STRAP, scale);

    // Satchel bag at left hip
    drawPixelRect(ctx, -6, -8, 3, 4, C_SATCHEL, scale);
    drawPixel(ctx, -5, -7, C_BRASS_MAIN, scale); // Satchel buckle

    // 4. Brass Belt Buckle & Buttons
    drawPixelRect(ctx, -4, -7, 9, 2, "#2b1c11", scale);
    drawPixelRect(ctx, -1, -7, 3, 2, C_BRASS_MAIN, scale);
    drawPixel(ctx, 0, -7, C_BRASS_LIGHT, scale);
    drawPixel(ctx, 1, -10, C_BRASS_MAIN, scale); // Coat buttons
    drawPixel(ctx, 1, -12, C_BRASS_MAIN, scale);

    // 5. Open Ancient Tome held in hands
    // Book body
    drawPixelRect(ctx, -4, -11, 9, 5, C_BOOK_COVER, scale);
    // Cream pages left & right
    drawPixelRect(ctx, -3, -11, 3, 4, C_BOOK_PAGE, scale);
    drawPixelRect(ctx, 1, -11, 3, 4, C_BOOK_PAGE, scale);
    // Dark spine / center fold
    drawPixelRect(ctx, 0, -11, 1, 4, C_BOOK_COVER, scale);
    // Rune ink marks
    drawPixel(ctx, -2, -10, C_BOOK_INK, scale);
    drawPixel(ctx, -2, -9, C_BOOK_INK, scale);
    drawPixel(ctx, 2, -10, C_BOOK_INK, scale);
    drawPixel(ctx, 2, -9, C_BOOK_INK, scale);

    // Hands holding book
    drawPixelRect(ctx, -5, -10, 2, 2, C_SKIN, scale);
    drawPixelRect(ctx, 4, -10, 2, 2, C_SKIN, scale);

    // Feather quill in right hand
    drawPixel(ctx, 5, -12, C_SHIRT, scale);
    drawPixel(ctx, 6, -14, C_SHIRT, scale);
    drawPixel(ctx, 7, -16, C_SHIRT, scale);
    drawPixel(ctx, 5, -11, C_BRASS_MAIN, scale); // Nib

    // 6. Head & Face
    drawPixelRect(ctx, -3, -19, 7, 6, C_SKIN, scale);

    // Neat chestnut hair with side part
    drawPixelRect(ctx, -4, -23, 9, 4, C_HAIR, scale);
    drawPixelRect(ctx, -3, -24, 7, 1, C_HAIR_LIGHT, scale);
    drawPixel(ctx, -1, -22, C_HAIR_LIGHT, scale); // Part line
    drawPixelRect(ctx, -4, -20, 1, 3, C_HAIR, scale);
    drawPixelRect(ctx, 4, -20, 1, 3, C_HAIR, scale);

    // Spectacles (Wire frames & glass reflection)
    drawPixelRect(ctx, -3, -18, 3, 3, C_BRASS_MAIN, scale);
    drawPixelRect(ctx, 1, -18, 3, 3, C_BRASS_MAIN, scale);
    drawPixel(ctx, 0, -17, C_BRASS_MAIN, scale); // Nose bridge
    // Lens interiors & shine
    drawPixel(ctx, -2, -17, "#e0f2fe", scale);
    drawPixel(ctx, -2, -18, "#ffffff", scale); // Glint
    drawPixel(ctx, 2, -17, "#e0f2fe", scale);
    drawPixel(ctx, 2, -18, "#ffffff", scale); // Glint
  } else if (facing === "up") {
    // Back View (Facing North / Away from camera)
    // 1. Trousers & shoes
    const leftBootY = isWalking && leftLegOffset < 0 ? -1 : 0;
    const rightBootY = isWalking && rightLegOffset < 0 ? -1 : 0;
    drawPixelRect(ctx, -4, -6 + leftBootY, 3, 4, C_PANTS, scale);
    drawPixelRect(ctx, -4, -2 + leftBootY, 3, 2, C_SHOES, scale);
    drawPixelRect(ctx, 2, -6 + rightBootY, 3, 4, C_PANTS, scale);
    drawPixelRect(ctx, 2, -2 + rightBootY, 3, 2, C_SHOES, scale);

    // 2. Scholar coat back & split tails
    drawPixelRect(ctx, -5, -13, 11, 7, C_COAT_MAIN, scale);
    drawPixelRect(ctx, -5, -6, 11, 2, C_COAT_SHADOW, scale);
    drawPixelRect(ctx, -6, -4, 4, 2, C_COAT_DARK, scale); // Left coat tail
    drawPixelRect(ctx, 3, -4, 4, 2, C_COAT_DARK, scale);  // Right coat tail
    drawPixelRect(ctx, 0, -13, 1, 8, C_COAT_SHADOW, scale); // Center seam

    // High collar
    drawPixelRect(ctx, -2, -14, 5, 1, C_SHIRT, scale);

    // Diagonal satchel strap across back
    drawPixel(ctx, -3, -13, C_STRAP, scale);
    drawPixel(ctx, -2, -12, C_STRAP, scale);
    drawPixel(ctx, -1, -11, C_STRAP, scale);
    drawPixel(ctx, 0, -10, C_STRAP, scale);
    drawPixel(ctx, 1, -9, C_STRAP, scale);
    drawPixel(ctx, 2, -8, C_STRAP, scale);
    drawPixel(ctx, 3, -7, C_STRAP, scale);
    drawPixelRect(ctx, 3, -8, 3, 4, C_SATCHEL, scale);

    // 3. Arms
    drawPixelRect(ctx, -6, -12, 2, 6, C_COAT_MAIN, scale);
    drawPixelRect(ctx, 5, -12, 2, 6, C_COAT_MAIN, scale);

    // 4. Back of head & chestnut hair
    drawPixelRect(ctx, -4, -23, 9, 6, C_HAIR, scale);
    drawPixelRect(ctx, -3, -24, 7, 2, C_HAIR_LIGHT, scale);
    drawPixelRect(ctx, -3, -17, 7, 3, C_HAIR, scale);
  } else {
    // Side View (facing left or right)
    // 1. Trousers & shoes
    const backBootX = -2 - leftLegOffset;
    const frontBootX = 1 + leftLegOffset;
    drawPixelRect(ctx, backBootX, -6, 3, 4, C_PANTS, scale);
    drawPixelRect(ctx, backBootX, -2, 3, 2, C_SHOES, scale);
    drawPixelRect(ctx, frontBootX, -6, 3, 4, C_PANTS, scale);
    drawPixelRect(ctx, frontBootX, -2, 3, 2, C_SHOES, scale);

    // 2. Scholar coat
    drawPixelRect(ctx, -3, -13, 6, 7, C_COAT_MAIN, scale);
    drawPixelRect(ctx, -4, -6, 7, 3, C_COAT_SHADOW, scale);

    // Satchel hanging on side
    drawPixelRect(ctx, -3, -8, 3, 4, C_SATCHEL, scale);
    drawPixel(ctx, -2, -7, C_BRASS_MAIN, scale);

    // 3. Arm holding tome & quill
    drawPixelRect(ctx, 0, -12, 3, 5, C_COAT_MAIN, scale);
    drawPixelRect(ctx, 2, -9, 2, 2, C_SKIN, scale);
    // Book profile
    drawPixelRect(ctx, 2, -10, 4, 3, C_BOOK_COVER, scale);
    drawPixelRect(ctx, 3, -10, 3, 2, C_BOOK_PAGE, scale);
    // Quill
    drawPixel(ctx, 4, -13, C_SHIRT, scale);
    drawPixel(ctx, 5, -15, C_SHIRT, scale);

    // 4. Head in profile
    drawPixelRect(ctx, -1, -19, 5, 6, C_SKIN, scale);
    drawPixelRect(ctx, -3, -23, 7, 4, C_HAIR, scale);
    drawPixelRect(ctx, -2, -24, 5, 1, C_HAIR_LIGHT, scale);
    // Profile Spectacles
    drawPixelRect(ctx, 2, -18, 3, 2, C_BRASS_MAIN, scale);
    drawPixel(ctx, 3, -18, "#ffffff", scale);
  }
}

// ---------------------------------------------------------------------------
// Character 4: SPECIALIST (Ranger / Worker)
// Forest hunter green tunic, leather chest guard, quiver of arrows strapped
// across back, leather bracers, feather in cap.
// ---------------------------------------------------------------------------

function drawSpecialist(
  ctx: CanvasRenderingContext2D,
  char: ArcadeCharacter,
  ticks: number,
  scale: number,
  facing: ArcadeFacing,
  isWalking: boolean,
  walkCycle: number,
  isCelebrating: boolean
): void {
  // Palettes
  const C_GREEN_LIGHT = "#6fa352";
  const C_GREEN_MAIN = "#487332";
  const C_GREEN_SHADOW = "#2b4b1c";
  const C_GREEN_DARK = "#162b0e";
  const C_LEATHER_LIGHT = "#9c5a30";
  const C_LEATHER_MAIN = "#7c4623";
  const C_LEATHER_SHADOW = "#4c2710";
  const C_BRASS = "#eab308";
  const C_QUIVER = "#523118";
  const C_ARROW_SHAFT = "#d4be92";
  const C_FLETCHING = "#f8fafc";
  const C_SKIN = "#fcd5b8";
  const C_HAIR = "#3b2413";
  const C_PANTS = "#3b3528";
  const C_BOOTS = "#422b1c";
  const C_FEATHER_GOLD = "#f59e0b";
  const C_FEATHER_RED = "#dc2626";

  // Leg offsets
  const leftLegOffset = isWalking ? Math.round(Math.sin(walkCycle) * 2.5) : 0;
  const rightLegOffset = isWalking ? Math.round(-Math.sin(walkCycle) * 2.5) : 0;

  if (facing === "down") {
    // Front View

    // 1. Quiver & Fletched arrows peeking over right shoulder
    drawPixelRect(ctx, 4, -16, 3, 7, C_QUIVER, scale);
    // 3 arrow fletchings peeking up
    drawPixel(ctx, 4, -18, C_FLETCHING, scale);
    drawPixel(ctx, 5, -19, C_FLETCHING, scale);
    drawPixel(ctx, 6, -18, C_FLETCHING, scale);
    drawPixel(ctx, 5, -17, C_ARROW_SHAFT, scale);

    // 2. Woodland trousers & silent boots
    const leftBootY = isWalking && leftLegOffset < 0 ? -1 : 0;
    const rightBootY = isWalking && rightLegOffset < 0 ? -1 : 0;
    drawPixelRect(ctx, -4, -6 + leftBootY, 3, 4, C_PANTS, scale);
    drawPixelRect(ctx, -4, -2 + leftBootY, 3, 2, C_BOOTS, scale);
    drawPixelRect(ctx, 2, -6 + rightBootY, 3, 4, C_PANTS, scale);
    drawPixelRect(ctx, 2, -2 + rightBootY, 3, 2, C_BOOTS, scale);

    // 3. Forest Hunter Green Tunic
    drawPixelRect(ctx, -5, -13, 11, 7, C_GREEN_MAIN, scale);
    drawPixelRect(ctx, -5, -6, 11, 2, C_GREEN_SHADOW, scale);

    // 4. Hardened Leather Chest Guard (Cuirass)
    drawPixelRect(ctx, -3, -13, 7, 6, C_LEATHER_MAIN, scale);
    drawPixelRect(ctx, -2, -13, 5, 2, C_LEATHER_LIGHT, scale);
    // Brass rivet studs
    drawPixel(ctx, -2, -12, C_BRASS, scale);
    drawPixel(ctx, 2, -12, C_BRASS, scale);
    drawPixel(ctx, -2, -9, C_BRASS, scale);
    drawPixel(ctx, 2, -9, C_BRASS, scale);

    // Belt & Quiver cross-strap
    drawPixelRect(ctx, -4, -7, 9, 2, C_LEATHER_SHADOW, scale);
    drawPixel(ctx, 0, -7, C_BRASS, scale);
    drawPixel(ctx, 3, -12, C_LEATHER_SHADOW, scale); // Strap to quiver

    // 5. Arms with Leather Bracers
    drawPixelRect(ctx, -7, -13, 2, 4, C_GREEN_MAIN, scale);
    drawPixelRect(ctx, 6, -13, 2, 4, C_GREEN_MAIN, scale);
    // Bracers
    drawPixelRect(ctx, -7, -9, 2, 3, C_LEATHER_MAIN, scale);
    drawPixel(ctx, -7, -8, C_BRASS, scale);
    drawPixelRect(ctx, 6, -9, 2, 3, C_LEATHER_MAIN, scale);
    drawPixel(ctx, 7, -8, C_BRASS, scale);
    // Hands
    drawPixelRect(ctx, -7, -6, 2, 2, C_SKIN, scale);
    drawPixelRect(ctx, 6, -6, 2, 2, C_SKIN, scale);

    // 6. Head & Face
    drawPixelRect(ctx, -3, -19, 7, 6, C_SKIN, scale);
    drawPixelRect(ctx, -4, -18, 1, 3, C_HAIR, scale);
    drawPixelRect(ctx, 4, -18, 1, 3, C_HAIR, scale);
    // Keen eyes
    drawPixel(ctx, -2, -17, "#1c1108", scale);
    drawPixel(ctx, 2, -17, "#1c1108", scale);
    drawPixel(ctx, -2, -18, "#ffffff", scale);
    drawPixel(ctx, 2, -18, "#ffffff", scale);

    // 7. Hunter Cap & Flamboyant Feather
    drawPixelRect(ctx, -5, -20, 11, 2, C_GREEN_DARK, scale);
    drawPixelRect(ctx, -4, -23, 9, 3, C_GREEN_MAIN, scale);
    drawPixelRect(ctx, -3, -24, 7, 1, C_GREEN_LIGHT, scale);
    // Feather
    drawPixel(ctx, 1, -22, C_BRASS, scale);
    drawPixel(ctx, 2, -23, C_FEATHER_GOLD, scale);
    drawPixel(ctx, 3, -24, C_FEATHER_GOLD, scale);
    drawPixel(ctx, 4, -25, C_FEATHER_RED, scale);
    drawPixel(ctx, 5, -26, C_FEATHER_RED, scale);
  } else if (facing === "up") {
    // Back View (Facing North / Away from camera)
    // 1. Woodland trousers & boots
    const leftBootY = isWalking && leftLegOffset < 0 ? -1 : 0;
    const rightBootY = isWalking && rightLegOffset < 0 ? -1 : 0;
    drawPixelRect(ctx, -4, -6 + leftBootY, 3, 4, C_PANTS, scale);
    drawPixelRect(ctx, -4, -2 + leftBootY, 3, 2, C_BOOTS, scale);
    drawPixelRect(ctx, 2, -6 + rightBootY, 3, 4, C_PANTS, scale);
    drawPixelRect(ctx, 2, -2 + rightBootY, 3, 2, C_BOOTS, scale);

    // 2. Hunter green tunic back
    drawPixelRect(ctx, -5, -13, 11, 7, C_GREEN_MAIN, scale);
    drawPixelRect(ctx, -5, -6, 11, 2, C_GREEN_SHADOW, scale);
    drawPixelRect(ctx, -4, -7, 9, 2, C_LEATHER_SHADOW, scale);

    // 3. Quiver strapped across upper back (prominent view)
    drawPixelRect(ctx, -1, -15, 5, 8, C_QUIVER, scale);
    drawPixelRect(ctx, -2, -16, 5, 2, C_LEATHER_SHADOW, scale);
    drawPixel(ctx, -1, -18, C_FLETCHING, scale);
    drawPixel(ctx, 1, -19, C_FLETCHING, scale);
    drawPixel(ctx, 3, -18, C_FLETCHING, scale);
    drawPixel(ctx, 0, -17, C_ARROW_SHAFT, scale);
    drawPixel(ctx, 2, -17, C_ARROW_SHAFT, scale);

    // 4. Arms & Bracers
    drawPixelRect(ctx, -7, -13, 2, 4, C_GREEN_MAIN, scale);
    drawPixelRect(ctx, 6, -13, 2, 4, C_GREEN_MAIN, scale);
    drawPixelRect(ctx, -7, -9, 2, 3, C_LEATHER_MAIN, scale);
    drawPixelRect(ctx, 6, -9, 2, 3, C_LEATHER_MAIN, scale);

    // 5. Back of head & hunter cap with feather
    drawPixelRect(ctx, -4, -18, 9, 4, C_HAIR, scale);
    drawPixelRect(ctx, -5, -20, 11, 2, C_GREEN_DARK, scale);
    drawPixelRect(ctx, -4, -23, 9, 3, C_GREEN_MAIN, scale);
    drawPixelRect(ctx, -3, -24, 7, 1, C_GREEN_LIGHT, scale);
    drawPixel(ctx, 1, -22, C_BRASS, scale);
    drawPixel(ctx, 2, -23, C_FEATHER_GOLD, scale);
    drawPixel(ctx, 3, -24, C_FEATHER_GOLD, scale);
    drawPixel(ctx, 4, -25, C_FEATHER_RED, scale);
  } else {
    // Side View (facing left or right)
    // 1. Quiver strapped across back
    drawPixelRect(ctx, -6, -17, 3, 10, C_QUIVER, scale);
    drawPixel(ctx, -6, -19, C_FLETCHING, scale);
    drawPixel(ctx, -5, -20, C_FLETCHING, scale);
    drawPixel(ctx, -5, -18, C_ARROW_SHAFT, scale);

    // 2. Boots in walk
    const backBootX = -2 - leftLegOffset;
    const frontBootX = 1 + leftLegOffset;
    drawPixelRect(ctx, backBootX, -6, 3, 4, C_PANTS, scale);
    drawPixelRect(ctx, backBootX, -2, 3, 2, C_BOOTS, scale);
    drawPixelRect(ctx, frontBootX, -6, 3, 4, C_PANTS, scale);
    drawPixelRect(ctx, frontBootX, -2, 3, 2, C_BOOTS, scale);

    // 3. Tunic & Chest Guard in profile
    drawPixelRect(ctx, -3, -13, 6, 7, C_GREEN_MAIN, scale);
    drawPixelRect(ctx, 0, -13, 4, 6, C_LEATHER_MAIN, scale);
    drawPixel(ctx, 2, -11, C_BRASS, scale);

    // 4. Arm & Bracer
    drawPixelRect(ctx, 0, -12, 2, 4, C_GREEN_MAIN, scale);
    drawPixelRect(ctx, 0, -8, 2, 3, C_LEATHER_MAIN, scale);
    drawPixel(ctx, 1, -7, C_BRASS, scale);
    drawPixelRect(ctx, 0, -5, 2, 2, C_SKIN, scale);

    // 5. Head in profile
    drawPixelRect(ctx, -1, -19, 5, 6, C_SKIN, scale);
    drawPixel(ctx, 2, -17, "#1c1108", scale);
    drawPixel(ctx, 2, -18, "#ffffff", scale);

    // Cap with feather trailing
    drawPixelRect(ctx, -4, -20, 9, 2, C_GREEN_DARK, scale);
    drawPixelRect(ctx, -3, -23, 7, 3, C_GREEN_MAIN, scale);
    drawPixel(ctx, -1, -22, C_FEATHER_GOLD, scale);
    drawPixel(ctx, -3, -24, C_FEATHER_GOLD, scale);
    drawPixel(ctx, -5, -25, C_FEATHER_RED, scale);
  }
}

// ---------------------------------------------------------------------------
// Character 5: SENTINEL (Knight / Worker)
// Polished iron armor with silver highlights, knight helm with eye slit,
// royal tabard, carrying a round heater shield on arm.
// ---------------------------------------------------------------------------

function drawSentinel(
  ctx: CanvasRenderingContext2D,
  char: ArcadeCharacter,
  ticks: number,
  scale: number,
  facing: ArcadeFacing,
  isWalking: boolean,
  walkCycle: number,
  isCelebrating: boolean
): void {
  // Palettes
  const C_STEEL_GLEAM = "#ffffff";
  const C_STEEL_LIGHT = "#cbd5e1";
  const C_STEEL_MAIN = "#64748b";
  const C_STEEL_SHADOW = "#334155";
  const C_STEEL_DEEP = "#0f172a";
  const C_TABARD_MAIN = "#b91c1c";
  const C_TABARD_SHADOW = "#7f1d1d";
  const C_GOLD_MAIN = "#facc15";
  const C_SHIELD_BLUE = "#1e40af";
  const C_EYE_EMBER = "#38bdf8";
  const C_PLUME_MAIN = "#dc2626";
  const C_PLUME_SHADOW = "#991b1b";

  // Leg offsets
  const leftLegOffset = isWalking ? Math.round(Math.sin(walkCycle) * 2.2) : 0;
  const rightLegOffset = isWalking ? Math.round(-Math.sin(walkCycle) * 2.2) : 0;

  if (facing === "down") {
    // Front View

    // 1. Armored Sabatons & Greaves (Boots & Leg plate)
    const leftBootY = isWalking && leftLegOffset < 0 ? -1 : 0;
    const rightBootY = isWalking && rightLegOffset < 0 ? -1 : 0;
    drawPixelRect(ctx, -4, -6 + leftBootY, 3, 4, C_STEEL_MAIN, scale);
    drawPixelRect(ctx, -4, -2 + leftBootY, 3, 2, C_STEEL_SHADOW, scale);
    drawPixel(ctx, -3, -5 + leftBootY, C_STEEL_LIGHT, scale); // Greave shine

    drawPixelRect(ctx, 2, -6 + rightBootY, 3, 4, C_STEEL_MAIN, scale);
    drawPixelRect(ctx, 2, -2 + rightBootY, 3, 2, C_STEEL_SHADOW, scale);
    drawPixel(ctx, 3, -5 + rightBootY, C_STEEL_LIGHT, scale);

    // 2. Iron Faulds / Hip Armor
    drawPixelRect(ctx, -5, -8, 11, 3, C_STEEL_SHADOW, scale);

    // 3. Royal Crimson Tabard over iron breastplate
    drawPixelRect(ctx, -4, -13, 9, 7, C_TABARD_MAIN, scale);
    drawPixelRect(ctx, -4, -7, 9, 2, C_TABARD_SHADOW, scale);
    // Embroidered Golden Knight Cross
    drawPixelRect(ctx, -1, -12, 3, 5, C_GOLD_MAIN, scale);
    drawPixelRect(ctx, -2, -10, 5, 2, C_GOLD_MAIN, scale);
    drawPixel(ctx, 0, -10, "#ffffff", scale); // Crest center

    // 4. Heavy Segmented Iron Pauldrons (Shoulder plates)
    drawPixelRect(ctx, -7, -14, 3, 5, C_STEEL_MAIN, scale);
    drawPixelRect(ctx, -7, -14, 3, 1, C_STEEL_GLEAM, scale); // Pauldron rim gleam
    drawPixelRect(ctx, -7, -10, 3, 1, C_STEEL_SHADOW, scale);

    drawPixelRect(ctx, 5, -14, 3, 5, C_STEEL_MAIN, scale);
    drawPixelRect(ctx, 5, -14, 3, 1, C_STEEL_GLEAM, scale);
    drawPixelRect(ctx, 5, -10, 3, 1, C_STEEL_SHADOW, scale);

    // 5. Heater Shield on Left Arm
    // Shield positioned proudly on Sentinel's left side
    const shieldX = 5;
    const shieldY = -12;
    // Shield body (pointed heater shield)
    drawPixelRect(ctx, shieldX, shieldY, 5, 8, C_SHIELD_BLUE, scale);
    drawPixelRect(ctx, shieldX + 1, shieldY + 8, 3, 2, C_SHIELD_BLUE, scale);
    drawPixel(ctx, shieldX + 2, shieldY + 10, C_SHIELD_BLUE, scale); // Point

    // Steel rim & rivets
    drawPixelRect(ctx, shieldX, shieldY, 5, 1, C_STEEL_LIGHT, scale);
    drawPixelRect(ctx, shieldX, shieldY, 1, 8, C_STEEL_LIGHT, scale);
    drawPixelRect(ctx, shieldX + 4, shieldY, 1, 8, C_STEEL_SHADOW, scale);
    drawPixel(ctx, shieldX, shieldY, C_STEEL_GLEAM, scale); // Rivet
    drawPixel(ctx, shieldX + 4, shieldY, C_STEEL_GLEAM, scale);

    // Golden Knight Emblem on shield
    drawPixelRect(ctx, shieldX + 1, shieldY + 3, 3, 3, C_GOLD_MAIN, scale);
    drawPixel(ctx, shieldX + 2, shieldY + 4, "#ffffff", scale);

    // Right Arm & Gauntlet
    drawPixelRect(ctx, -7, -9, 2, 4, C_STEEL_MAIN, scale);
    drawPixelRect(ctx, -7, -5, 2, 2, C_STEEL_SHADOW, scale);

    // 6. Knight Helm with Eye Slit & Plume
    // Helm dome
    drawPixelRect(ctx, -5, -23, 11, 9, C_STEEL_MAIN, scale);
    drawPixelRect(ctx, -4, -24, 9, 2, C_STEEL_LIGHT, scale);
    drawPixelRect(ctx, 0, -24, 1, 9, C_STEEL_GLEAM, scale); // Center comb shine
    drawPixelRect(ctx, -5, -15, 11, 2, C_STEEL_SHADOW, scale); // Gorget / Neck guard

    // Narrow dark visor eye slit
    drawPixelRect(ctx, -4, -18, 9, 2, C_STEEL_DEEP, scale);
    // Piercing heroic cyan eye ember inside slit
    drawPixel(ctx, -2, -18, C_EYE_EMBER, scale);
    drawPixel(ctx, 2, -18, C_EYE_EMBER, scale);

    // Scarlet Plume flowing from helm crest
    drawPixelRect(ctx, -1, -27, 3, 4, C_PLUME_MAIN, scale);
    drawPixelRect(ctx, -2, -26, 1, 3, C_PLUME_SHADOW, scale);
    drawPixelRect(ctx, 0, -28, 2, 2, C_PLUME_MAIN, scale);
  } else if (facing === "up") {
    // Back View (Facing North / Away from camera)
    // 1. Armored Sabatons & Greaves
    const leftBootY = isWalking && leftLegOffset < 0 ? -1 : 0;
    const rightBootY = isWalking && rightLegOffset < 0 ? -1 : 0;
    drawPixelRect(ctx, -4, -6 + leftBootY, 3, 4, C_STEEL_MAIN, scale);
    drawPixelRect(ctx, -4, -2 + leftBootY, 3, 2, C_STEEL_SHADOW, scale);
    drawPixelRect(ctx, 2, -6 + rightBootY, 3, 4, C_STEEL_MAIN, scale);
    drawPixelRect(ctx, 2, -2 + rightBootY, 3, 2, C_STEEL_SHADOW, scale);

    // 2. Iron backplate & tabard back
    drawPixelRect(ctx, -5, -13, 11, 9, C_STEEL_MAIN, scale);
    drawPixelRect(ctx, -4, -13, 9, 7, C_TABARD_MAIN, scale);
    drawPixelRect(ctx, -4, -7, 9, 2, C_TABARD_SHADOW, scale);
    drawPixelRect(ctx, -5, -8, 11, 3, C_STEEL_SHADOW, scale);

    // 3. Pauldrons from behind
    drawPixelRect(ctx, -7, -14, 3, 5, C_STEEL_MAIN, scale);
    drawPixelRect(ctx, 5, -14, 3, 5, C_STEEL_MAIN, scale);

    // 4. Heater Shield on left arm seen from behind
    const shieldX = -9;
    const shieldY = -12;
    drawPixelRect(ctx, shieldX, shieldY, 4, 8, "#2d1c13", scale);
    drawPixelRect(ctx, shieldX + 1, shieldY + 2, 2, 2, "#7c4623", scale);
    drawPixelRect(ctx, shieldX + 1, shieldY + 5, 2, 2, "#7c4623", scale);

    // Right arm
    drawPixelRect(ctx, 6, -9, 2, 4, C_STEEL_MAIN, scale);

    // 5. Back of Knight Helm & Scarlet Plume
    drawPixelRect(ctx, -5, -23, 11, 9, C_STEEL_MAIN, scale);
    drawPixelRect(ctx, -4, -24, 9, 2, C_STEEL_LIGHT, scale);
    drawPixelRect(ctx, 0, -24, 1, 9, C_STEEL_GLEAM, scale);
    drawPixelRect(ctx, -5, -15, 11, 2, C_STEEL_SHADOW, scale);
    // Scarlet plume from back
    drawPixelRect(ctx, -1, -27, 3, 4, C_PLUME_MAIN, scale);
    drawPixelRect(ctx, -2, -26, 1, 3, C_PLUME_SHADOW, scale);
    drawPixelRect(ctx, 0, -28, 2, 2, C_PLUME_MAIN, scale);
  } else {
    // Side View (facing left or right)
    // 1. Armored greaves in walk stride
    const backBootX = -2 - leftLegOffset;
    const frontBootX = 1 + leftLegOffset;
    drawPixelRect(ctx, backBootX, -6, 3, 4, C_STEEL_MAIN, scale);
    drawPixelRect(ctx, backBootX, -2, 3, 2, C_STEEL_SHADOW, scale);
    drawPixelRect(ctx, frontBootX, -6, 3, 4, C_STEEL_MAIN, scale);
    drawPixelRect(ctx, frontBootX, -2, 3, 2, C_STEEL_SHADOW, scale);

    // 2. Tabard over plate
    drawPixelRect(ctx, -3, -13, 6, 7, C_TABARD_MAIN, scale);
    drawPixel(ctx, 0, -10, C_GOLD_MAIN, scale);

    // 3. Round heater shield facing camera
    const shieldX = 1;
    const shieldY = -12;
    drawPixelRect(ctx, shieldX, shieldY, 5, 8, C_SHIELD_BLUE, scale);
    drawPixelRect(ctx, shieldX + 1, shieldY + 8, 3, 2, C_SHIELD_BLUE, scale);
    drawPixel(ctx, shieldX + 2, shieldY + 10, C_SHIELD_BLUE, scale);
    // Shield rim
    drawPixelRect(ctx, shieldX, shieldY, 5, 1, C_STEEL_LIGHT, scale);
    drawPixelRect(ctx, shieldX, shieldY, 1, 8, C_STEEL_LIGHT, scale);
    drawPixel(ctx, shieldX + 2, shieldY + 3, C_GOLD_MAIN, scale);
    drawPixel(ctx, shieldX + 1, shieldY + 2, C_STEEL_GLEAM, scale);

    // 4. Helm in profile
    drawPixelRect(ctx, -3, -23, 8, 9, C_STEEL_MAIN, scale);
    drawPixelRect(ctx, -2, -24, 6, 2, C_STEEL_LIGHT, scale);
    // Profile eye slit
    drawPixelRect(ctx, 2, -18, 3, 2, C_STEEL_DEEP, scale);
    drawPixel(ctx, 3, -18, C_EYE_EMBER, scale);

    // Plume trailing back
    drawPixelRect(ctx, -4, -26, 4, 3, C_PLUME_MAIN, scale);
    drawPixelRect(ctx, -6, -25, 3, 2, C_PLUME_SHADOW, scale);
  }
}

// ---------------------------------------------------------------------------
// Main Character Renderer
// ---------------------------------------------------------------------------

export function drawArcadeCharacter(
  ctx: CanvasRenderingContext2D,
  char: ArcadeCharacter,
  ticks: number,
  options?: ArcadeDrawOptions
): void {
  const showNameplate = options?.showNameplate ?? true;
  const showBalance = options?.showBalance ?? true;
  const showShadow = options?.showShadow ?? true;
  const scale = options?.pixelScale ?? 2;

  // 1. Soft Floor Shadow
  if (showShadow) {
    ctx.save();
    const shadowStretch =
      char.state === "walking" ? 1 + Math.sin(ticks * 0.35) * 0.15 : 1;
    ctx.beginPath();
    ctx.ellipse(
      Math.round(char.x),
      Math.round(char.y + 3),
      Math.round(14 * shadowStretch),
      Math.round(5 / shadowStretch),
      0,
      0,
      Math.PI * 2
    );
    ctx.fillStyle = "rgba(16, 10, 6, 0.38)";
    ctx.fill();
    ctx.restore();
  }

  // 2. Vertical bobbing & hop calculations
  const isWalking = char.state === "walking";
  const isCelebrating = char.state === "celebrating";
  const isRejected = char.state === "rejected";

  // Walking bob vs. breathing idle bob
  const walkCycle = ticks * 0.35;
  const walkBob = isWalking ? Math.abs(Math.sin(walkCycle)) * 2 : 0;
  const idleBob = !isWalking ? Math.sin(ticks * 0.08) * 1.0 : 0;
  const hopY = isCelebrating ? -Math.abs(Math.sin(ticks * 0.28)) * 5 : 0;
  const slumpY = isRejected ? 2 : 0;

  const charY = Math.round(char.y - walkBob + idleBob + hopY + slumpY);

  // 3. Sprite Matrix Transformation
  ctx.save();
  ctx.translate(Math.round(char.x), charY);

  // Facing left flips the sprite horizontally for pixel-perfect symmetry
  const facing = char.facing || "down";
  if (facing === "left") {
    ctx.scale(-1, 1);
  }

  // Dispatch to dedicated 16-bit RPG avatar renderer
  switch (char.avatarType) {
    case "questor":
      drawQuestor(
        ctx,
        char,
        ticks,
        scale,
        facing,
        isWalking,
        walkCycle,
        isCelebrating
      );
      break;
    case "claude":
      drawClaude(
        ctx,
        char,
        ticks,
        scale,
        facing,
        isWalking,
        walkCycle,
        isCelebrating
      );
      break;
    case "gemini":
      drawGemini(
        ctx,
        char,
        ticks,
        scale,
        facing,
        isWalking,
        walkCycle,
        isCelebrating
      );
      break;
    case "specialist":
      drawSpecialist(
        ctx,
        char,
        ticks,
        scale,
        facing,
        isWalking,
        walkCycle,
        isCelebrating
      );
      break;
    case "sentinel":
      drawSentinel(
        ctx,
        char,
        ticks,
        scale,
        facing,
        isWalking,
        walkCycle,
        isCelebrating
      );
      break;
    default:
      drawQuestor(
        ctx,
        char,
        ticks,
        scale,
        facing,
        isWalking,
        walkCycle,
        isCelebrating
      );
      break;
  }

  ctx.restore();

  // 4. Celebrating State Effects (Pixel Gold Stars & Exclamation, No Emojis)
  if (isCelebrating) {
    const starCycle = ticks * 0.08;
    const starY1 = char.y - 56 + Math.sin(starCycle) * 3;
    const starY2 = char.y - 64 + Math.sin(starCycle + 1.6) * 3;
    const starY3 = char.y - 56 + Math.sin(starCycle + 3.2) * 3;

    drawPixelStar(ctx, char.x - 18, starY1, 6, "#ffd700");
    drawPixelExclamation(ctx, char.x, char.y - 58, "#facc15");
    drawPixelStar(ctx, char.x + 18, starY3, 6, "#ffd700");
    drawPixelStar(ctx, char.x, starY2 - 8, 5, "#fff3a8");
  }

  // 4b. Rejected State Effects (Pixel Cross, No Emojis)
  if (isRejected) {
    const markY = char.y - 56 + Math.sin(ticks * 0.1) * 2;
    drawPixelCross(ctx, char.x, markY, "#c96b6b");
  }

  // 5. Floating Nameplate & Balance Tag below Character (Unified Compact Badge)
  if (showNameplate || showBalance) {
    drawCharacterBadge(ctx, char);
  }
}

// ---------------------------------------------------------------------------
// Word Wrapping Helper for Floating Dialogue
// ---------------------------------------------------------------------------

function wrapDialogueText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number
): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let currentLine = words[0] || "";

  for (let i = 1; i < words.length; i++) {
    const word = words[i];
    const candidate = currentLine + " " + word;
    if (ctx.measureText(candidate).width <= maxWidth) {
      currentLine = candidate;
    } else {
      lines.push(currentLine);
      currentLine = word;
    }
  }
  lines.push(currentLine);
  return lines;
}

// ---------------------------------------------------------------------------
// Floating Speech Bubbles (Parchment Box with Pointer Tail, No Emojis)
// Clamped to canvas bounds to prevent overflow and overlapping issues
// ---------------------------------------------------------------------------

export function drawCharacterDialogue(
  ctx: CanvasRenderingContext2D,
  char: ArcadeCharacter
): void {
  if (!char.dialogue || char.dialogue.trim().length === 0) {
    return;
  }

  ctx.save();
  ctx.font = "500 12px 'DM Sans', -apple-system, sans-serif";

  const maxBubbleWidth = 220;
  const lines = wrapDialogueText(ctx, char.dialogue, maxBubbleWidth);

  let maxLineWidth = 0;
  for (const line of lines) {
    const w = ctx.measureText(line).width;
    if (w > maxLineWidth) maxLineWidth = w;
  }

  const paddingX = 14;
  const paddingY = 8;
  const lineHeight = 16;
  const bubbleW = Math.max(90, Math.round(maxLineWidth + paddingX * 2));
  const bubbleH = Math.round(lines.length * lineHeight + paddingY * 2);

  // Clamped within 960x480 canvas bounds to prevent clipping or header collision
  const rawBubbleX = Math.round(char.x - bubbleW / 2);
  const bubbleX = Math.max(14, Math.min(960 - bubbleW - 14, rawBubbleX));
  const bubbleY = Math.max(8, Math.round(char.y - 54 - bubbleH));

  // Soft drop shadow
  ctx.fillStyle = "rgba(18, 12, 8, 0.32)";
  ctx.beginPath();
  if (typeof ctx.roundRect === "function") {
    ctx.roundRect(bubbleX + 2, bubbleY + 2, bubbleW, bubbleH, 6);
  } else {
    ctx.rect(bubbleX + 2, bubbleY + 2, bubbleW, bubbleH);
  }
  ctx.fill();

  // Cozy warm aged parchment box
  ctx.fillStyle = "#fdf7e7";
  ctx.beginPath();
  if (typeof ctx.roundRect === "function") {
    ctx.roundRect(bubbleX, bubbleY, bubbleW, bubbleH, 6);
  } else {
    ctx.rect(bubbleX, bubbleY, bubbleW, bubbleH);
  }
  ctx.fill();

  // Parchment border (using character dialogue color or warm leather)
  const borderColor = char.dialogueColor || "#784a24";
  ctx.strokeStyle = borderColor;
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Pointer tail pointing down towards the character's head
  const tailBaseX = Math.max(bubbleX + 16, Math.min(bubbleX + bubbleW - 16, Math.round(char.x)));
  const tailBaseY = bubbleY + bubbleH;
  const tailTipY = Math.min(char.y - 36, tailBaseY + 7);

  ctx.beginPath();
  ctx.moveTo(tailBaseX - 5, tailBaseY);
  ctx.lineTo(tailBaseX, tailTipY);
  ctx.lineTo(tailBaseX + 5, tailBaseY);
  ctx.closePath();
  ctx.fillStyle = "#fdf7e7";
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(tailBaseX - 5, tailBaseY - 0.5);
  ctx.lineTo(tailBaseX, tailTipY);
  ctx.lineTo(tailBaseX + 5, tailBaseY - 0.5);
  ctx.strokeStyle = borderColor;
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Readable dark quill ink text
  ctx.fillStyle = "#261608";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  const textStartX = bubbleX + bubbleW / 2;
  const textStartY = bubbleY + paddingY + lineHeight / 2;
  lines.forEach((line, idx) => {
    ctx.fillText(line, textStartX, textStartY + idx * lineHeight);
  });

  ctx.restore();
}
