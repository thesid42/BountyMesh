/**
 * BountyMesh - ArcadeEnvironment.ts
 *
 * Authentic 16-bit RPG Cozy Adventurer's Guild Hall Interior.
 * Rendered onto HTML5 Canvas at 60 FPS.
 *
 * CRITICAL RULE: ZERO EMOJIS. No unicode emoji characters anywhere.
 */

// Helper to safely draw rounded rectangles across browser/node environments
function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
): void {
  const radius = Math.min(r, w / 2, h / 2);
  if (typeof ctx.roundRect === "function") {
    ctx.roundRect(x, y, w, h, radius);
  } else {
    ctx.moveTo(x + radius, y);
    ctx.arcTo(x + w, y, x + w, y + h, radius);
    ctx.arcTo(x + w, y + h, x, y + h, radius);
    ctx.arcTo(x, y + h, x, y, radius);
    ctx.arcTo(x, y, x + w, y, radius);
    ctx.closePath();
  }
}

/**
 * 1. FLOOR & ARCHITECTURE
 * - Fieldstone wall on upper portion (y: 0 to 100) with timber crossbeams
 * - Dark timber baseboards
 * - Oak wood tavern floorboards with grain lines and staggered joints
 * - Woven ornamental guild runner rug in center with bordered fringe
 */
function drawFloorAndArchitecture(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number
): void {
  // A. Upper Fieldstone Wall (y: 0 to 100)
  ctx.fillStyle = "#221914";
  ctx.fillRect(0, 0, width, 100);

  // Irregular fieldstone texture on wall
  ctx.fillStyle = "#2c211b";
  const stoneRows = [
    { y: 8, h: 22, offset: 0 },
    { y: 32, h: 20, offset: 28 },
    { y: 54, h: 22, offset: 12 },
    { y: 78, h: 18, offset: 36 },
  ];

  stoneRows.forEach((row) => {
    for (let x = -30 + row.offset; x < width + 40; x += 58) {
      // Individual stone block
      ctx.fillStyle = "#2a1f18";
      ctx.fillRect(x + 2, row.y + 2, 52, row.h - 4);

      // Top/left highlight
      ctx.fillStyle = "#3a2c23";
      ctx.fillRect(x + 2, row.y + 2, 52, 2);
      ctx.fillRect(x + 2, row.y + 2, 2, row.h - 4);

      // Bottom/right mortar shadow
      ctx.fillStyle = "#150e0a";
      ctx.fillRect(x + 2, row.y + row.h - 3, 52, 2);
      ctx.fillRect(x + 52, row.y + 2, 2, row.h - 4);
    }
  });

  // Vertical timber support posts
  const postSpacing = 160;
  for (let x = 0; x <= width; x += postSpacing) {
    // Post base and shadow
    ctx.fillStyle = "#1c120c";
    ctx.fillRect(x - 6, 0, 12, 100);
    // Post wood grain highlight
    ctx.fillStyle = "#332216";
    ctx.fillRect(x - 4, 0, 4, 100);
    // Dark seam
    ctx.fillStyle = "#0f0906";
    ctx.fillRect(x + 5, 0, 2, 100);

    // Iron reinforcement bolt brackets
    ctx.fillStyle = "#4a5568";
    ctx.fillRect(x - 5, 20, 10, 4);
    ctx.fillRect(x - 5, 80, 10, 4);
    ctx.fillStyle = "#cbd5e1";
    ctx.fillRect(x - 2, 21, 2, 2);
    ctx.fillRect(x - 2, 81, 2, 2);
  }

  // Horizontal timber crossbeam along top and mid-wall
  ctx.fillStyle = "#1a110a";
  ctx.fillRect(0, 0, width, 8);
  ctx.fillStyle = "#362417";
  ctx.fillRect(0, 1, width, 3);

  // Heavy timber baseboard separating stone wall from floorboards
  ctx.fillStyle = "#130b07";
  ctx.fillRect(0, 94, width, 10);
  ctx.fillStyle = "#382315";
  ctx.fillRect(0, 95, width, 3);
  ctx.fillStyle = "#0c0704";
  ctx.fillRect(0, 103, width, 2);

  // Arched Oak Entrance Doorway (x: 94 to 164, y: 30 to 94)
  ctx.fillStyle = "#160e0a";
  ctx.beginPath();
  drawRoundedRect(ctx, 94, 30, 70, 64, 8);
  ctx.fill();
  ctx.strokeStyle = "#0d0705";
  ctx.lineWidth = 2;
  ctx.stroke();

  // Double oak doors
  ctx.fillStyle = "#2c1c13";
  ctx.fillRect(98, 34, 30, 60);
  ctx.fillRect(130, 34, 30, 60);
  ctx.strokeStyle = "#170f0a";
  ctx.lineWidth = 1;
  ctx.strokeRect(98, 34, 30, 60);
  ctx.strokeRect(130, 34, 30, 60);

  // Iron strap hinges
  ctx.fillStyle = "#374151";
  ctx.fillRect(96, 44, 12, 3);
  ctx.fillRect(96, 76, 12, 3);
  ctx.fillRect(150, 44, 12, 3);
  ctx.fillRect(150, 76, 12, 3);

  // Brass door handles
  ctx.fillStyle = "#d4b86a";
  ctx.fillRect(124, 62, 3, 8);
  ctx.fillRect(131, 62, 3, 8);

  // Entrance sign banner
  ctx.font = "600 9px 'DM Sans', sans-serif";
  ctx.fillStyle = "#d4b86a";
  ctx.textAlign = "center";
  ctx.fillText("Entrance", 129, 24);
  ctx.textAlign = "left";

  // B. Oak Wood Tavern Floorboards (y: 100 to height)
  ctx.fillStyle = "#2d1f16";
  ctx.fillRect(0, 104, width, height - 104);

  // Plank shadow cast by baseboard
  ctx.fillStyle = "rgba(10, 6, 4, 0.45)";
  ctx.fillRect(0, 104, width, 6);

  const plankH = 34;
  let rowIdx = 0;

  for (let y = 104; y < height; y += plankH) {
    // Alternate slight board tone variations
    const boardTone = rowIdx % 2 === 0 ? "#2f2017" : "#2b1d14";
    ctx.fillStyle = boardTone;
    ctx.fillRect(0, y, width, plankH);

    // Horizontal plank seam (groove shadow)
    ctx.fillStyle = "#160e09";
    ctx.fillRect(0, y, width, 2);
    // Upper plank subtle highlight line
    ctx.fillStyle = "#3d2a1e";
    ctx.fillRect(0, y + 2, width, 1);

    // Subtle wood grain lines running along the plank
    ctx.fillStyle = "rgba(55, 38, 26, 0.5)";
    ctx.fillRect(0, y + 10, width, 1);
    ctx.fillRect(0, y + 22, width, 1);

    // Staggered vertical plank joints (butt joints)
    const staggerOffset = (rowIdx % 3) * 64;
    for (let x = staggerOffset; x < width; x += 150) {
      // Joint seam
      ctx.fillStyle = "#140c08";
      ctx.fillRect(x, y, 2, plankH);
      ctx.fillStyle = "#3b281d";
      ctx.fillRect(x + 2, y + 1, 1, plankH - 1);

      // Iron floorboard pegs/nails near joints
      ctx.fillStyle = "#0f0906";
      ctx.fillRect(x - 5, y + 6, 2, 2);
      ctx.fillRect(x - 5, y + plankH - 8, 2, 2);
      ctx.fillRect(x + 5, y + 6, 2, 2);
      ctx.fillRect(x + 5, y + plankH - 8, 2, 2);
    }

    rowIdx++;
  }

  // C. Woven Ornamental Guild Runner Rug (Center Stage)
  const rugW = 340;
  const rugH = 250;
  const rugX = width / 2 - rugW / 2;
  const rugY = 175;

  // Floor rug cast shadow
  ctx.fillStyle = "rgba(10, 6, 4, 0.4)";
  ctx.beginPath();
  drawRoundedRect(ctx, rugX - 4, rugY - 3, rugW + 8, rugH + 8, 14);
  ctx.fill();

  // Outer dark border
  ctx.fillStyle = "#2a0d0d";
  ctx.beginPath();
  drawRoundedRect(ctx, rugX, rugY, rugW, rugH, 10);
  ctx.fill();

  // Woven fringe / tassels on left and right ends
  for (let fy = rugY + 6; fy < rugY + rugH - 6; fy += 6) {
    ctx.fillStyle = fy % 12 === 0 ? "#d4b86a" : "#8c7241";
    // Left fringe
    ctx.fillRect(rugX - 5, fy, 5, 3);
    // Right fringe
    ctx.fillRect(rugX + rugW, fy, 5, 3);
  }

  // Gold woven ornamental border
  ctx.strokeStyle = "#c49a45";
  ctx.lineWidth = 3;
  ctx.beginPath();
  drawRoundedRect(ctx, rugX + 6, rugY + 6, rugW - 12, rugH - 12, 6);
  ctx.stroke();

  // Secondary inner gold thread border
  ctx.strokeStyle = "#7c5c24";
  ctx.lineWidth = 1;
  ctx.beginPath();
  drawRoundedRect(ctx, rugX + 12, rugY + 12, rugW - 24, rugH - 24, 4);
  ctx.stroke();

  // Deep ruby field
  ctx.fillStyle = "#4a1515";
  ctx.beginPath();
  drawRoundedRect(ctx, rugX + 14, rugY + 14, rugW - 28, rugH - 28, 4);
  ctx.fill();

  // Subtle diamond knotwork pattern in rug center
  ctx.strokeStyle = "rgba(196, 154, 69, 0.25)";
  ctx.lineWidth = 1;
  const midX = width / 2;
  const midY = rugY + rugH / 2;
  for (let s = 24; s <= 96; s += 24) {
    ctx.beginPath();
    ctx.moveTo(midX, midY - s);
    ctx.lineTo(midX + s * 1.4, midY);
    ctx.lineTo(midX, midY + s);
    ctx.lineTo(midX - s * 1.4, midY);
    ctx.closePath();
    ctx.stroke();
  }
}

/**
 * 2. COZY FIREPLACE / HEARTH (Center Back Wall)
 * - Cobblestone brick hearth with chimney
 * - Cast-iron grate with burning wood logs
 * - Animated pixel flames flickering and rising
 * - Warm amber light glow on surrounding floor
 * - Tiny rising smoke and ember particles
 */
function drawFireplace(
  ctx: CanvasRenderingContext2D,
  width: number,
  ticks: number
): void {
  const fpX = width / 2 - 54;
  const fpY = 12;
  const fpW = 108;
  const fpH = 88;

  // A. Hearth masonry structure (Cobblestone Chimney)
  ctx.fillStyle = "#1e1713";
  ctx.fillRect(fpX - 6, fpY, fpW + 12, fpH);

  // Cobblestone bricks texture on chimney
  const brickRows = [
    { y: fpY + 4, h: 10, shift: 0 },
    { y: fpY + 16, h: 10, shift: 12 },
    { y: fpY + 28, h: 11, shift: 6 },
    { y: fpY + 41, h: 11, shift: 16 },
  ];

  brickRows.forEach((row) => {
    for (let bx = fpX - 4 + (row.shift % 18); bx < fpX + fpW + 4; bx += 22) {
      ctx.fillStyle = "#382920";
      ctx.fillRect(bx, row.y, 20, row.h - 2);
      ctx.fillStyle = "#4a392e";
      ctx.fillRect(bx, row.y, 20, 2);
      ctx.fillStyle = "#120c09";
      ctx.fillRect(bx, row.y + row.h - 3, 20, 1);
    }
  });

  // Heavy carved stone mantel beam
  ctx.fillStyle = "#2b211a";
  ctx.fillRect(fpX - 10, fpY + 38, fpW + 20, 10);
  ctx.fillStyle = "#48362b";
  ctx.fillRect(fpX - 10, fpY + 38, fpW + 20, 2);
  ctx.fillStyle = "#110b08";
  ctx.fillRect(fpX - 10, fpY + 47, fpW + 20, 2);

  // Dark firebox interior opening
  const fireboxX = fpX + 16;
  const fireboxY = fpY + 48;
  const fireboxW = fpW - 32;
  const fireboxH = fpH - 48;

  ctx.fillStyle = "#0c0604";
  ctx.fillRect(fireboxX, fireboxY, fireboxW, fireboxH);
  ctx.strokeStyle = "#1a0f09";
  ctx.lineWidth = 2;
  ctx.strokeRect(fireboxX, fireboxY, fireboxW, fireboxH);

  // Hearth stone floor ledge
  ctx.fillStyle = "#33251c";
  ctx.fillRect(fireboxX - 6, fpY + fpH, fireboxW + 12, 6);
  ctx.fillStyle = "#4a372a";
  ctx.fillRect(fireboxX - 6, fpY + fpH, fireboxW + 12, 2);

  // Cast-iron firewood grate
  ctx.fillStyle = "#151210";
  ctx.fillRect(fireboxX + 6, fireboxY + fireboxH - 8, fireboxW - 12, 4);
  // Grate vertical teeth
  for (let gx = fireboxX + 10; gx < fireboxX + fireboxW - 10; gx += 8) {
    ctx.fillRect(gx, fireboxY + fireboxH - 14, 3, 10);
    ctx.fillStyle = "#2d2824";
    ctx.fillRect(gx, fireboxY + fireboxH - 14, 1, 10);
    ctx.fillStyle = "#151210";
  }

  // Crossed burning wood logs
  ctx.fillStyle = "#3b1e10";
  ctx.fillRect(fireboxX + 10, fireboxY + fireboxH - 10, fireboxW - 20, 6);
  ctx.fillStyle = "#271208";
  ctx.fillRect(fireboxX + 14, fireboxY + fireboxH - 14, fireboxW - 28, 5);

  // Glowing fissures in wood
  ctx.fillStyle = "#ea580c";
  ctx.fillRect(fireboxX + 18, fireboxY + fireboxH - 9, 8, 2);
  ctx.fillRect(fireboxX + 34, fireboxY + fireboxH - 12, 10, 2);

  // B. Animated Pixel Fire Flames
  const fireCenterX = fireboxX + fireboxW / 2;
  const fireBaseY = fireboxY + fireboxH - 8;

  // Multiple columns of flickering 16-bit pixel flame tongues
  const flameCols = [-16, -11, -6, -2, 3, 8, 13];
  flameCols.forEach((offsetX, i) => {
    const wave = Math.sin(ticks * 0.22 + i * 1.1) * 4 + Math.cos(ticks * 0.35 + i * 0.8) * 3;
    const flameH = Math.max(10, 18 - Math.abs(offsetX) * 0.6 + wave);
    const colX = fireCenterX + offsetX;

    // Deep red-orange flame base
    ctx.fillStyle = "#dc2626";
    ctx.fillRect(colX - 2, fireBaseY - flameH, 5, flameH);

    // Vibrant amber mid-flame
    ctx.fillStyle = "#f97316";
    ctx.fillRect(colX - 1, fireBaseY - flameH * 0.8, 3, flameH * 0.8);

    // Warm golden heart
    ctx.fillStyle = "#facc15";
    ctx.fillRect(colX, fireBaseY - flameH * 0.55, 2, flameH * 0.55);

    // White-hot core tip
    if (i >= 2 && i <= 4) {
      ctx.fillStyle = "#fef08a";
      ctx.fillRect(colX, fireBaseY - flameH * 0.3, 2, flameH * 0.3);
    }
  });

  // C. Rising Smoke & Ember Particles (Deterministic based on ticks)
  // Tiny rising embers
  for (let i = 0; i < 9; i++) {
    const progress = ((ticks * 1.4 + i * 31) % 90) / 90;
    const emberY = fireBaseY - progress * 56;
    const driftX = Math.sin(ticks * 0.08 + i * 1.5) * 8 + (i - 4) * 3;
    const emberX = fireCenterX + driftX;
    const alpha = (1 - progress) * 0.85;

    ctx.fillStyle = i % 2 === 0 ? `rgba(253, 224, 71, ${alpha})` : `rgba(249, 115, 22, ${alpha})`;
    ctx.fillRect(emberX, emberY, 2, 2);
  }

  // Faint rising chimney smoke puffs
  for (let j = 0; j < 5; j++) {
    const sProgress = ((ticks * 0.5 + j * 47) % 110) / 110;
    const smokeY = fireboxY + 4 - sProgress * 42;
    const smokeX = fireCenterX + Math.sin(ticks * 0.04 + j * 2.2) * 10;
    const sRadius = 3 + sProgress * 6;
    const sAlpha = (1 - sProgress) * 0.16;

    ctx.fillStyle = `rgba(148, 133, 122, ${sAlpha})`;
    ctx.beginPath();
    ctx.arc(smokeX, smokeY, sRadius, 0, Math.PI * 2);
    ctx.fill();
  }

  // D. Warm Amber Light Glow on Surrounding Floor
  const glowPulse = 0.22 + Math.sin(ticks * 0.12) * 0.04;
  const glowGrad = ctx.createRadialGradient(
    fireCenterX,
    fpY + fpH + 6,
    12,
    fireCenterX,
    fpY + fpH + 6,
    130
  );
  glowGrad.addColorStop(0, `rgba(245, 158, 11, ${glowPulse})`);
  glowGrad.addColorStop(0.4, `rgba(217, 119, 6, ${glowPulse * 0.5})`);
  glowGrad.addColorStop(1, "rgba(180, 83, 9, 0)");

  ctx.fillStyle = glowGrad;
  ctx.beginPath();
  ctx.arc(fireCenterX, fpY + fpH + 6, 130, 0, Math.PI * 2);
  ctx.fill();
}

/**
 * 3. GUILD COUNTER / TAVERN BAR (Left Wall)
 * - Polished oak counter with wood grain
 * - Two large wooden cider/ale barrels on racks with brass taps
 * - Rows of glass potion bottles (ruby, emerald, sapphire) on shelves behind the bar
 */
function drawGuildCounter(
  ctx: CanvasRenderingContext2D,
  width: number
): void {
  // Suppress unused variable warning if width is passed
  void width;

  // A. Wall Shelves with Potion Bottles (y: 110 to 148, x: 12 to 102)
  // Shelf brackets and timber planks
  ctx.fillStyle = "#1e130c";
  ctx.fillRect(12, 132, 90, 4);
  ctx.fillStyle = "#3b2518";
  ctx.fillRect(12, 132, 90, 2);

  ctx.fillStyle = "#1e130c";
  ctx.fillRect(12, 156, 90, 4);
  ctx.fillStyle = "#3b2518";
  ctx.fillRect(12, 156, 90, 2);

  // Rows of glass potion bottles on upper and lower shelves
  interface PotionDef {
    x: number;
    y: number;
    color: string;
    liquid: string;
    shape: "round" | "tall";
  }

  const potions: PotionDef[] = [
    // Top shelf
    { x: 20, y: 120, color: "#ef4444", liquid: "#b91c1c", shape: "round" }, // Ruby healing
    { x: 36, y: 118, color: "#10b981", liquid: "#047857", shape: "tall" },  // Emerald stamina
    { x: 52, y: 120, color: "#3b82f6", liquid: "#1d4ed8", shape: "round" }, // Sapphire mana
    { x: 68, y: 118, color: "#a855f7", liquid: "#7e22ce", shape: "tall" },  // Amethyst arcane
    { x: 84, y: 120, color: "#f59e0b", liquid: "#b45309", shape: "round" }, // Amber honey draft
    // Lower shelf
    { x: 24, y: 144, color: "#3b82f6", liquid: "#1d4ed8", shape: "tall" },
    { x: 42, y: 146, color: "#ef4444", liquid: "#b91c1c", shape: "round" },
    { x: 60, y: 144, color: "#10b981", liquid: "#047857", shape: "tall" },
    { x: 78, y: 146, color: "#06b6d4", liquid: "#0e7490", shape: "round" },
  ];

  potions.forEach((p) => {
    // Glass bottle cork stopper
    ctx.fillStyle = "#b58d59";
    ctx.fillRect(p.x + 2, p.y - 3, 4, 3);

    // Glass bottle neck
    ctx.fillStyle = "#94a3b8";
    ctx.fillRect(p.x + 2, p.y, 4, 3);

    // Bottle body
    if (p.shape === "round") {
      ctx.fillStyle = p.liquid;
      ctx.beginPath();
      ctx.arc(p.x + 4, p.y + 7, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = p.color;
      ctx.lineWidth = 1;
      ctx.stroke();

      // Specular glass highlight
      ctx.fillStyle = "rgba(255, 255, 255, 0.65)";
      ctx.fillRect(p.x + 2, p.y + 4, 2, 2);
    } else {
      ctx.fillStyle = p.liquid;
      ctx.fillRect(p.x, p.y + 3, 8, 9);
      ctx.strokeStyle = p.color;
      ctx.lineWidth = 1;
      ctx.strokeRect(p.x, p.y + 3, 8, 9);

      // Specular highlight
      ctx.fillStyle = "rgba(255, 255, 255, 0.65)";
      ctx.fillRect(p.x + 1, p.y + 4, 2, 4);
    }
  });

  // B. Two Large Wooden Ale/Cider Barrels on Sturdy Racks (x: 18 to 98, y: 168 to 216)
  const drawBarrel = (bx: number, by: number) => {
    // Heavy wooden rack legs underneath
    ctx.fillStyle = "#1e130c";
    ctx.fillRect(bx - 2, by + 26, 5, 8);
    ctx.fillRect(bx + 29, by + 26, 5, 8);

    // Barrel barrel body (oak staves)
    ctx.fillStyle = "#4a3222";
    ctx.beginPath();
    drawRoundedRect(ctx, bx, by, 32, 26, 6);
    ctx.fill();

    // Wood stave lines
    ctx.strokeStyle = "#322014";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(bx + 8, by + 1);
    ctx.lineTo(bx + 8, by + 25);
    ctx.moveTo(bx + 16, by);
    ctx.lineTo(bx + 16, by + 26);
    ctx.moveTo(bx + 24, by + 1);
    ctx.lineTo(bx + 24, by + 25);
    ctx.stroke();

    // Black cast-iron hoop bands
    ctx.fillStyle = "#1a1614";
    ctx.fillRect(bx + 4, by, 3, 26);
    ctx.fillRect(bx + 25, by, 3, 26);
    // Silver rivet dots on hoops
    ctx.fillStyle = "#94a3b8";
    ctx.fillRect(bx + 5, by + 4, 1, 2);
    ctx.fillRect(bx + 5, by + 20, 1, 2);
    ctx.fillRect(bx + 26, by + 4, 1, 2);
    ctx.fillRect(bx + 26, by + 20, 1, 2);

    // Polished brass tap spigot
    ctx.fillStyle = "#d4b86a";
    ctx.fillRect(bx + 14, by + 18, 5, 4);
    ctx.fillRect(bx + 17, by + 14, 2, 5); // Tap handle
    ctx.fillStyle = "#fef08a";
    ctx.fillRect(bx + 15, by + 19, 2, 2);
  };

  drawBarrel(18, 172);
  drawBarrel(58, 172);

  // C. Polished Oak Tavern Counter Bar (y: 218 to 286, x: 8 to 106)
  // Floor shadow
  ctx.fillStyle = "rgba(10, 6, 4, 0.4)";
  ctx.fillRect(6, 282, 104, 6);

  // Counter front paneling (dark oak planks)
  ctx.fillStyle = "#2c1c13";
  ctx.fillRect(8, 230, 98, 54);
  ctx.strokeStyle = "#160e09";
  ctx.lineWidth = 1.5;
  ctx.strokeRect(8, 230, 98, 54);

  // Vertical panel divide staves
  for (let px = 28; px < 100; px += 24) {
    ctx.fillStyle = "#1b110b";
    ctx.fillRect(px, 230, 2, 54);
    ctx.fillStyle = "#3e271a";
    ctx.fillRect(px + 2, 230, 1, 54);
  }

  // Brass footrail near bottom
  ctx.fillStyle = "#d4b86a";
  ctx.fillRect(10, 276, 94, 3);
  ctx.fillStyle = "#855d24";
  ctx.fillRect(10, 279, 94, 1);

  // Polished oak countertop with shiny wood grain and beveled edge
  ctx.fillStyle = "#4a3120";
  ctx.beginPath();
  drawRoundedRect(ctx, 6, 218, 102, 14, 4);
  ctx.fill();

  // Top highlight sheen on polished oak
  ctx.fillStyle = "#6d4a32";
  ctx.fillRect(8, 219, 98, 3);

  // Countertop drop shadow on front panel
  ctx.fillStyle = "#150d09";
  ctx.fillRect(8, 232, 98, 3);

  // Pewter tavern mugs on counter
  ctx.fillStyle = "#64748b";
  ctx.fillRect(24, 212, 7, 8);
  ctx.fillRect(72, 212, 7, 8);
  // Mug foam head
  ctx.fillStyle = "#fef3c7";
  ctx.fillRect(24, 211, 7, 2);
  ctx.fillRect(72, 211, 7, 2);
}

/**
 * 4. GUILD NOTICE BOARD
 * - Cork/wood bulletin board mounted on wall
 * - Small pinned parchment task sheets of various shapes
 * - Red wax seals and brass push pins
 */
function drawNoticeBoard(
  ctx: CanvasRenderingContext2D,
  width: number
): void {
  // Suppress unused variable warning if width is passed
  void width;

  const nbX = 180;
  const nbY = 18;
  const nbW = 126;
  const nbH = 70;

  // Outer carved dark wood frame
  ctx.fillStyle = "#2a1c12";
  ctx.fillRect(nbX - 4, nbY - 4, nbW + 8, nbH + 8);
  ctx.strokeStyle = "#120a06";
  ctx.lineWidth = 2;
  ctx.strokeRect(nbX - 4, nbY - 4, nbW + 8, nbH + 8);

  // Frame inner bevel
  ctx.fillStyle = "#422e1e";
  ctx.fillRect(nbX - 2, nbY - 2, nbW + 4, 2);
  ctx.fillRect(nbX - 2, nbY - 2, 2, nbH + 4);

  // Cork bulletin backing
  ctx.fillStyle = "#8a613c";
  ctx.fillRect(nbX, nbY, nbW, nbH);

  // Cork speckle texture
  ctx.fillStyle = "#6e4b2d";
  for (let sx = nbX + 6; sx < nbX + nbW - 6; sx += 14) {
    for (let sy = nbY + 6; sy < nbY + nbH - 6; sy += 12) {
      ctx.fillRect(sx + ((sy * 3) % 7), sy, 2, 2);
    }
  }

  // Board Header Label
  ctx.font = "700 8px 'DM Sans', sans-serif";
  ctx.fillStyle = "#d4b86a";
  ctx.textAlign = "center";
  ctx.fillText("GUILD BOUNTIES", nbX + nbW / 2, nbY + 9);

  // Pinned parchment task sheets
  interface SheetDef {
    x: number;
    y: number;
    w: number;
    h: number;
    pinColor: string;
    seal: boolean;
  }

  const sheets: SheetDef[] = [
    { x: nbX + 8, y: nbY + 14, w: 32, h: 46, pinColor: "#dc2626", seal: true },
    { x: nbX + 46, y: nbY + 16, w: 34, h: 48, pinColor: "#d4b86a", seal: false },
    { x: nbX + 86, y: nbY + 14, w: 32, h: 42, pinColor: "#2563eb", seal: true },
  ];

  sheets.forEach((s) => {
    // Parchment paper shadow
    ctx.fillStyle = "rgba(18, 12, 8, 0.4)";
    ctx.fillRect(s.x + 2, s.y + 2, s.w, s.h);

    // Parchment paper sheet
    ctx.fillStyle = "#ede0c4";
    ctx.fillRect(s.x, s.y, s.w, s.h);
    ctx.strokeStyle = "#a38965";
    ctx.lineWidth = 1;
    ctx.strokeRect(s.x, s.y, s.w, s.h);

    // Scribbled quest lines
    ctx.fillStyle = "#6d5841";
    for (let ly = s.y + 8; ly < s.y + s.h - 8; ly += 5) {
      ctx.fillRect(s.x + 4, ly, s.w - 8, 1.5);
    }

    // Red wax seal if present
    if (s.seal) {
      ctx.fillStyle = "#b91c1c";
      ctx.beginPath();
      ctx.arc(s.x + s.w / 2, s.y + s.h - 8, 3.5, 0, Math.PI * 2);
      ctx.fill();
    }

    // Brass/colored pin at top
    ctx.fillStyle = s.pinColor;
    ctx.beginPath();
    ctx.arc(s.x + s.w / 2, s.y + 3, 2, 0, Math.PI * 2);
    ctx.fill();
  });

  ctx.textAlign = "left";
}

/**
 * 5. ANCIENT BOOKSHELF & ALCHEMY CABINET
 * - Bookshelf filled with multi-colored spellbook spines and scrolls
 * - Alchemical flask and ancient parchment scrolls
 */
function drawBookshelf(
  ctx: CanvasRenderingContext2D,
  width: number
): void {
  // Positioned between center fireplace and gold vault
  const bsX = width / 2 + 96;
  const bsY = 14;
  const bsW = 124;
  const bsH = 78;

  // Sturdy dark mahogany wood cabinet frame
  ctx.fillStyle = "#241710";
  ctx.fillRect(bsX, bsY, bsW, bsH);
  ctx.strokeStyle = "#100905";
  ctx.lineWidth = 2;
  ctx.strokeRect(bsX, bsY, bsW, bsH);

  // Shelves divider timbers
  const shelfY1 = bsY + 38;
  const shelfY2 = bsY + bsH - 4;

  ctx.fillStyle = "#3a251a";
  ctx.fillRect(bsX + 2, shelfY1, bsW - 4, 4);
  ctx.fillRect(bsX + 2, shelfY2, bsW - 4, 4);

  // Multi-colored spellbook spines on Top Shelf
  interface BookDef {
    x: number;
    w: number;
    h: number;
    color: string;
    foil: string;
  }

  const topBooks: BookDef[] = [
    { x: bsX + 6, w: 7, h: 26, color: "#991b1b", foil: "#fef08a" },  // Crimson spellbook
    { x: bsX + 14, w: 9, h: 29, color: "#581c87", foil: "#d8b4fe" }, // Void grimoire
    { x: bsX + 24, w: 6, h: 24, color: "#065f46", foil: "#6ee7b7" }, // Herbalist manual
    { x: bsX + 31, w: 8, h: 27, color: "#1e3a8a", foil: "#93c5fd" }, // Celestial star tome
    { x: bsX + 40, w: 10, h: 30, color: "#78350f", foil: "#fde68a" },// Dragonlore codex
    { x: bsX + 51, w: 7, h: 25, color: "#831843", foil: "#fbcfe8" }, // Arcane rubric
    { x: bsX + 59, w: 8, h: 28, color: "#1e293b", foil: "#cbd5e1" }, // Shadow ledger
  ];

  topBooks.forEach((b) => {
    // Book spine
    ctx.fillStyle = b.color;
    ctx.fillRect(b.x, shelfY1 - b.h, b.w, b.h);

    // Spine top/bottom caps
    ctx.fillStyle = "#110b07";
    ctx.fillRect(b.x, shelfY1 - b.h, b.w, 1.5);
    ctx.fillRect(b.x, shelfY1 - 1.5, b.w, 1.5);

    // Gold/silver foil embossed band on spine
    ctx.fillStyle = b.foil;
    ctx.fillRect(b.x + 1, shelfY1 - b.h * 0.65, b.w - 2, 2);
    ctx.fillRect(b.x + 1, shelfY1 - b.h * 0.35, b.w - 2, 2);
  });

  // Alchemical glass alembic / beaker on top shelf right side
  const alembicX = bsX + 86;
  const alembicY = shelfY1 - 18;
  ctx.fillStyle = "#8b5cf6";
  ctx.beginPath();
  ctx.arc(alembicX + 6, alembicY + 12, 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#94a3b8";
  ctx.fillRect(alembicX + 4, alembicY, 4, 8); // Beaker neck
  ctx.fillStyle = "rgba(255, 255, 255, 0.7)";
  ctx.fillRect(alembicX + 3, alembicY + 8, 2, 3); // Glint

  // Rolled scrolls on Bottom Shelf (bsX + 6 to bsX + 46)
  for (let scX = bsX + 6; scX < bsX + 44; scX += 9) {
    ctx.fillStyle = "#f5ede0";
    ctx.fillRect(scX, shelfY2 - 24, 7, 24);
    ctx.fillStyle = "#ab987a";
    ctx.strokeRect(scX, shelfY2 - 24, 7, 24);
    // Ribbon tie around scroll
    ctx.fillStyle = scX % 18 === 0 ? "#b91c1c" : "#047857";
    ctx.fillRect(scX, shelfY2 - 13, 7, 3);
  }

  // Leaning books on bottom shelf right side
  const btmBooks: BookDef[] = [
    { x: bsX + 52, w: 9, h: 28, color: "#164e63", foil: "#a5f3fc" },
    { x: bsX + 62, w: 8, h: 26, color: "#701a75", foil: "#f5d0fe" },
    { x: bsX + 71, w: 10, h: 30, color: "#365314", foil: "#bef264" },
    { x: bsX + 82, w: 8, h: 25, color: "#854d0e", foil: "#fde047" },
    { x: bsX + 91, w: 9, h: 27, color: "#4c0519", foil: "#fecdd3" },
    { x: bsX + 101, w: 8, h: 26, color: "#1e1b4b", foil: "#c7d2fe" },
  ];

  btmBooks.forEach((b) => {
    ctx.fillStyle = b.color;
    ctx.fillRect(b.x, shelfY2 - b.h, b.w, b.h);
    ctx.fillStyle = b.foil;
    ctx.fillRect(b.x + 1, shelfY2 - b.h * 0.5, b.w - 2, 2);
  });
}

/**
 * 6. RESEARCH TABLES / DESKS FOR SPECIALIST AGENTS
 * - 3 research tables where workers work:
 *   - Desk 1: Gemini Desk (740, 250)
 *   - Desk 2: Specialist Desk (740, 380)
 *   - Desk 3: Sentinel Desk (230, 380)
 * - Each table has rolled scrolls, an open manuscript, a candle holder with flickering flame, and inkpot with quill
 */
function drawResearchTables(
  ctx: CanvasRenderingContext2D,
  ticks: number
): void {
  interface DeskConfig {
    x: number;
    y: number;
    label: string;
    labelColor: string;
  }

  const desks: DeskConfig[] = [
    { x: 820, y: 240, label: "Scholar", labelColor: "#6d8e9c" },
    { x: 820, y: 370, label: "Ranger", labelColor: "#84a96e" },
    { x: 170, y: 370, label: "Sentinel", labelColor: "#c96b6b" },
  ];

  desks.forEach((desk) => {
    const dw = 72;
    const dh = 48;
    const dx = desk.x - dw / 2;
    const dy = desk.y - dh / 2;

    // Floor drop shadow under table
    ctx.fillStyle = "rgba(10, 6, 4, 0.45)";
    ctx.beginPath();
    drawRoundedRect(ctx, dx - 4, dy + dh - 6, dw + 8, 12, 6);
    ctx.fill();

    // Table legs (turned timber legs)
    ctx.fillStyle = "#1e130c";
    ctx.fillRect(dx + 4, dy + dh - 4, 6, 8);
    ctx.fillRect(dx + dw - 10, dy + dh - 4, 6, 8);

    // Oak scholar desk body
    ctx.fillStyle = "#3b2618";
    ctx.beginPath();
    drawRoundedRect(ctx, dx, dy, dw, dh, 4);
    ctx.fill();
    ctx.strokeStyle = "#160d08";
    ctx.lineWidth = 2;
    ctx.stroke();

    // Tabletop polished edge bevel
    ctx.fillStyle = "#533723";
    ctx.fillRect(dx + 2, dy + 2, dw - 4, 3);
    ctx.fillStyle = "#271910";
    ctx.fillRect(dx + 2, dy + dh - 4, dw - 4, 2);

    // 1. Open Manuscript with two pages and mini script lines
    const msX = dx + 18;
    const msY = dy + 10;
    const msW = 28;
    const msH = 20;

    // Open book cover back
    ctx.fillStyle = "#78350f";
    ctx.fillRect(msX - 1, msY - 1, msW + 2, msH + 2);

    // Left page (Ivory)
    ctx.fillStyle = "#f5ede0";
    ctx.fillRect(msX, msY, msW / 2 - 1, msH);
    // Right page
    ctx.fillRect(msX + msW / 2, msY, msW / 2 - 1, msH);

    // Book center spine groove
    ctx.fillStyle = "#a89479";
    ctx.fillRect(msX + msW / 2 - 1, msY, 1.5, msH);

    // Miniature scribbled script lines on pages
    ctx.fillStyle = "#78644f";
    // Left page lines with red initial capital
    ctx.fillStyle = "#dc2626";
    ctx.fillRect(msX + 2, msY + 3, 3, 3);
    ctx.fillStyle = "#78644f";
    ctx.fillRect(msX + 6, msY + 4, msW / 2 - 8, 1);
    ctx.fillRect(msX + 2, msY + 8, msW / 2 - 4, 1);
    ctx.fillRect(msX + 2, msY + 12, msW / 2 - 5, 1);
    ctx.fillRect(msX + 2, msY + 16, msW / 2 - 4, 1);
    // Right page lines
    ctx.fillRect(msX + msW / 2 + 2, msY + 4, msW / 2 - 4, 1);
    ctx.fillRect(msX + msW / 2 + 2, msY + 8, msW / 2 - 5, 1);
    ctx.fillRect(msX + msW / 2 + 2, msY + 12, msW / 2 - 4, 1);
    ctx.fillRect(msX + msW / 2 + 2, msY + 16, msW / 2 - 6, 1);

    // 2. Rolled Parchment Scrolls on Desk (dx + 6, dy + 12)
    ctx.fillStyle = "#ede0c4";
    ctx.fillRect(dx + 6, dy + 12, 8, 18);
    ctx.strokeStyle = "#9c8260";
    ctx.lineWidth = 1;
    ctx.strokeRect(dx + 6, dy + 12, 8, 18);
    // Ribbon wrap around scroll
    ctx.fillStyle = "#047857";
    ctx.fillRect(dx + 6, dy + 20, 8, 3);

    // 3. Brass Candle Holder with Wax Candle and Flickering Pixel Flame
    const candleX = dx + dw - 16;
    const candleY = dy + 14;

    // Brass saucer base
    ctx.fillStyle = "#d4b86a";
    ctx.beginPath();
    ctx.ellipse(candleX + 3, candleY + 14, 6, 2.5, 0, 0, Math.PI * 2);
    ctx.fill();

    // Wax candle cylinder
    ctx.fillStyle = "#fef3c7";
    ctx.fillRect(candleX + 1, candleY + 4, 4, 10);
    // Candle wick
    ctx.fillStyle = "#1e130c";
    ctx.fillRect(candleX + 2.5, candleY + 2, 1, 2);

    // Animated flickering candle flame
    const flameFlicker = Math.sin(ticks * 0.28 + desk.x * 0.05) * 1.5;
    const flameH = 5 + flameFlicker;

    // Soft warm candlelight halo on table
    const candleGlow = ctx.createRadialGradient(
      candleX + 3,
      candleY - 1,
      2,
      candleX + 3,
      candleY - 1,
      24
    );
    candleGlow.addColorStop(0, "rgba(250, 204, 21, 0.25)");
    candleGlow.addColorStop(1, "rgba(245, 158, 11, 0)");
    ctx.fillStyle = candleGlow;
    ctx.beginPath();
    ctx.arc(candleX + 3, candleY - 1, 24, 0, Math.PI * 2);
    ctx.fill();

    // Vibrant candle flame core
    ctx.fillStyle = "#f97316";
    ctx.beginPath();
    ctx.arc(candleX + 3, candleY - flameH / 2, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#fef08a";
    ctx.beginPath();
    ctx.arc(candleX + 3, candleY - flameH / 2 + 1, 1.8, 0, Math.PI * 2);
    ctx.fill();

    // 4. Dark Glass Inkpot with Diagonal Feather Quill
    const inkX = dx + dw - 22;
    const inkY = dy + 30;

    // Glass inkpot
    ctx.fillStyle = "#0f172a";
    ctx.fillRect(inkX, inkY, 6, 6);
    ctx.fillStyle = "#475569";
    ctx.fillRect(inkX + 1, inkY - 1, 4, 1); // Metallic cap rim

    // Feather quill pen slanted diagonally
    ctx.strokeStyle = "#e2e8f0";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(inkX + 3, inkY + 1);
    ctx.lineTo(inkX + 11, inkY - 9);
    ctx.stroke();
    // Quill feather fletching
    ctx.fillStyle = "#cbd5e1";
    ctx.fillRect(inkX + 8, inkY - 10, 4, 3);
  });

  ctx.textAlign = "left";
}

/**
 * 7. GUILD GOLD VAULT (Top Right)
 * - Heavy iron-banded oak treasure chest with brass corner brackets and shiny padlock
 * - Clean label showing the gold amount secured (`${totalPayoutStr} Gold Secured`)
 */
function drawGoldVault(
  ctx: CanvasRenderingContext2D,
  width: number,
  totalPayoutStr: string
): void {
  const vX = width - 184;
  const vY = 24;
  const vW = 154;
  const vH = 68;

  // Vault stone niche shadow
  ctx.fillStyle = "#140c08";
  ctx.fillRect(vX - 4, vY - 4, vW + 8, vH + 8);
  ctx.strokeStyle = "#080402";
  ctx.lineWidth = 2;
  ctx.strokeRect(vX - 4, vY - 4, vW + 8, vH + 8);

  // Oak treasure chest body
  ctx.fillStyle = "#3e2719";
  ctx.beginPath();
  drawRoundedRect(ctx, vX, vY + 16, vW, vH - 16, 4);
  ctx.fill();

  // Arched oak chest lid
  ctx.fillStyle = "#4c3121";
  ctx.beginPath();
  drawRoundedRect(ctx, vX, vY, vW, 20, 6);
  ctx.fill();

  // Lid highlight
  ctx.fillStyle = "#63432e";
  ctx.fillRect(vX + 2, vY + 1, vW - 4, 3);

  // Horizontal wood slat seams on chest
  ctx.fillStyle = "#26170d";
  ctx.fillRect(vX, vY + 32, vW, 2);
  ctx.fillRect(vX, vY + 46, vW, 2);

  // Heavy riveted iron bands across chest
  const bandXs = [vX + 22, vX + 54, vX + 98, vX + 130];
  bandXs.forEach((bx) => {
    // Iron band
    ctx.fillStyle = "#27303f";
    ctx.fillRect(bx, vY, 8, vH);
    ctx.fillStyle = "#3d4b61";
    ctx.fillRect(bx + 1, vY, 2, vH);

    // Silver rivet dots on iron bands
    ctx.fillStyle = "#cbd5e1";
    ctx.fillRect(bx + 3, vY + 4, 2, 2);
    ctx.fillRect(bx + 3, vY + 24, 2, 2);
    ctx.fillRect(bx + 3, vY + 40, 2, 2);
    ctx.fillRect(bx + 3, vY + 58, 2, 2);
  });

  // Brass corner brackets on chest corners
  const drawCorner = (cx: number, cy: number) => {
    ctx.fillStyle = "#d4b86a";
    ctx.fillRect(cx, cy, 7, 7);
    ctx.fillStyle = "#fef08a";
    ctx.fillRect(cx + 1, cy + 1, 2, 2);
  };

  drawCorner(vX, vY);
  drawCorner(vX + vW - 7, vY);
  drawCorner(vX, vY + vH - 7);
  drawCorner(vX + vW - 7, vY + vH - 7);

  // Polished heavy brass padlock on chest latch (Center)
  const lockX = vX + vW / 2 - 6;
  const lockY = vY + 18;

  // Latch hasp plate
  ctx.fillStyle = "#27303f";
  ctx.fillRect(lockX - 2, lockY - 4, 16, 8);

  // Padlock shackle loop
  ctx.strokeStyle = "#94a3b8";
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.arc(lockX + 6, lockY + 2, 5, Math.PI, 0);
  ctx.stroke();

  // Padlock brass body
  ctx.fillStyle = "#eab308";
  ctx.beginPath();
  drawRoundedRect(ctx, lockX, lockY + 2, 12, 11, 2);
  ctx.fill();
  ctx.strokeStyle = "#a16207";
  ctx.lineWidth = 1;
  ctx.stroke();

  // Shiny gold lock highlight
  ctx.fillStyle = "#fef08a";
  ctx.fillRect(lockX + 2, lockY + 4, 3, 2);

  // Padlock keyhole
  ctx.fillStyle = "#1e130c";
  ctx.fillRect(lockX + 5, lockY + 6, 2, 3);
  ctx.fillRect(lockX + 4.5, lockY + 9, 3, 2);

  // Stack of glistening gold coins beside vault chest
  ctx.fillStyle = "#d4b86a";
  for (let c = 0; c < 4; c++) {
    ctx.beginPath();
    ctx.ellipse(vX + 12 + c * 2, vY + vH - 4 - c * 2.5, 5, 2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#855d24";
    ctx.lineWidth = 0.8;
    ctx.stroke();
  }

  // Clean label showing the gold amount secured: `${totalPayoutStr} Gold Secured`
  ctx.font = "700 9px 'DM Sans', sans-serif";
  ctx.fillStyle = "#d4b86a";
  ctx.textAlign = "center";
  ctx.fillText("ESCROW VAULT", vX + vW / 2, vY - 8);

  // Vault Balance Plaque
  ctx.fillStyle = "#17100b";
  ctx.beginPath();
  drawRoundedRect(ctx, vX + 10, vY + vH - 22, vW - 20, 18, 4);
  ctx.fill();
  ctx.strokeStyle = "#d4b86a";
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.font = "700 11px 'JetBrains Mono', monospace";
  ctx.fillStyle = "#84a96e";
  ctx.fillText(`${totalPayoutStr} Gold Secured`, vX + vW / 2, vY + vH - 9);

  ctx.textAlign = "left";
}

/**
 * 8. GUILDMASTER STRATEGY TABLE (Center Stage)
 * - Round oak conference table
 * - Open parchment map of the realm
 * - Magical crystal focus stone with floating hover bob
 * - Soft pulsing halo on floor during bidding wars
 */
function drawStrategyTable(
  ctx: CanvasRenderingContext2D,
  width: number,
  ticks: number,
  stagePhase: string
): void {
  const stageCenterX = width / 2;
  const stageCenterY = 255;

  // A. Soft Pulsing Halo on Floor during Bidding Wars
  const isBiddingActive =
    stagePhase === "announcing" ||
    stagePhase === "bidding" ||
    stagePhase === "matched";

  if (isBiddingActive) {
    const pulseT = Math.sin(ticks * 0.08);
    const haloRadiusX = 125 + pulseT * 8;
    const haloRadiusY = 52 + pulseT * 3.5;
    const haloAlpha = 0.28 + pulseT * 0.12;

    // Outer glow
    ctx.beginPath();
    ctx.ellipse(stageCenterX, stageCenterY, haloRadiusX, haloRadiusY, 0, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(143, 121, 166, ${haloAlpha})`;
    ctx.lineWidth = 2.5;
    ctx.stroke();

    // Inner rune orbit ring
    ctx.beginPath();
    ctx.ellipse(stageCenterX, stageCenterY, haloRadiusX - 12, haloRadiusY - 5, 0, 0, Math.PI * 2);
    ctx.setLineDash([4, 8]);
    ctx.lineDashOffset = ticks * 0.8;
    ctx.strokeStyle = `rgba(212, 184, 106, ${haloAlpha * 0.8})`;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.setLineDash([]); // Reset dash

    // 4 Orbiting Arcane Rune Sparkles
    for (let r = 0; r < 4; r++) {
      const angle = ticks * 0.03 + (r * Math.PI) / 2;
      const rx = stageCenterX + Math.cos(angle) * haloRadiusX;
      const ry = stageCenterY + Math.sin(angle) * haloRadiusY;

      ctx.fillStyle = `rgba(245, 197, 66, ${haloAlpha + 0.3})`;
      ctx.fillRect(rx - 2, ry - 2, 4, 4);
    }
  }

  // Soft Crimson Warning Pulse on Rubric Rejection / Escrow Refund
  if (stagePhase === "rejected") {
    const pulseT = Math.sin(ticks * 0.1);
    ctx.beginPath();
    ctx.ellipse(stageCenterX, stageCenterY, 120 + pulseT * 4, 48 + pulseT * 2, 0, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(201, 107, 107, ${0.4 + pulseT * 0.15})`;
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  // B. Round Oak Conference Table Base Shadow
  ctx.beginPath();
  ctx.ellipse(stageCenterX, stageCenterY + 12, 114, 46, 0, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(10, 6, 4, 0.55)";
  ctx.fill();

  // Heavy carved oak pedestal table base
  ctx.fillStyle = "#26170d";
  ctx.fillRect(stageCenterX - 18, stageCenterY - 4, 36, 18);
  ctx.strokeStyle = "#100905";
  ctx.lineWidth = 1.5;
  ctx.strokeRect(stageCenterX - 18, stageCenterY - 4, 36, 18);

  // Tabletop Ellipse (Polished Rich Oak)
  ctx.beginPath();
  ctx.ellipse(stageCenterX, stageCenterY, 110, 42, 0, 0, Math.PI * 2);
  ctx.fillStyle = "#3e271a";
  ctx.fill();
  ctx.strokeStyle = "#170e09";
  ctx.lineWidth = 3;
  ctx.stroke();

  // Tabletop edge bevel highlight
  ctx.beginPath();
  ctx.ellipse(stageCenterX, stageCenterY - 1, 108, 40, 0, 0, Math.PI * 2);
  ctx.strokeStyle = "#5a3a27";
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Inner decorative wood inlay groove
  ctx.beginPath();
  ctx.ellipse(stageCenterX, stageCenterY, 92, 34, 0, 0, Math.PI * 2);
  ctx.strokeStyle = "#271910";
  ctx.lineWidth = 1;
  ctx.stroke();

  // C. Open Parchment Realm Map Spread in Center
  const mapW = 72;
  const mapH = 30;
  const mapX = stageCenterX - mapW / 2;
  const mapY = stageCenterY - mapH / 2;

  // Map shadow
  ctx.fillStyle = "rgba(14, 8, 5, 0.4)";
  ctx.fillRect(mapX + 2, mapY + 2, mapW, mapH);

  // Map parchment
  ctx.fillStyle = "#ede1ca";
  ctx.fillRect(mapX, mapY, mapW, mapH);
  ctx.strokeStyle = "#8f7959";
  ctx.lineWidth = 1;
  ctx.strokeRect(mapX, mapY, mapW, mapH);

  // Hand-drawn coastline and continents
  ctx.strokeStyle = "#7c684d";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(mapX + 8, mapY + 6);
  ctx.bezierCurveTo(mapX + 22, mapY + 4, mapX + 28, mapY + 14, mapX + 38, mapY + 8);
  ctx.bezierCurveTo(mapX + 48, mapY + 12, mapX + 58, mapY + 6, mapX + 64, mapY + 16);
  ctx.stroke();

  // Mountain peak symbols (^ ^ ^)
  ctx.fillStyle = "#63503b";
  ctx.font = "8px sans-serif";
  ctx.fillText("^", mapX + 16, mapY + 16);
  ctx.fillText("^", mapX + 22, mapY + 15);
  ctx.fillText("^", mapX + 28, mapY + 17);

  // Dashed red quest expedition trail
  ctx.strokeStyle = "#b91c1c";
  ctx.lineWidth = 1;
  ctx.setLineDash([2, 3]);
  ctx.beginPath();
  ctx.moveTo(mapX + 12, mapY + 22);
  ctx.lineTo(mapX + 34, mapY + 20);
  ctx.lineTo(mapX + 52, mapY + 24);
  ctx.stroke();
  ctx.setLineDash([]); // Reset dash

  // Quest target cross mark
  ctx.strokeStyle = "#991b1b";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(mapX + 54, mapY + 22);
  ctx.lineTo(mapX + 58, mapY + 26);
  ctx.moveTo(mapX + 58, mapY + 22);
  ctx.lineTo(mapX + 54, mapY + 26);
  ctx.stroke();

  // D. Magical Crystal Focus Stone (Floating above table)
  const floatBob = Math.sin(ticks * 0.06) * 4;
  const crystalX = stageCenterX;
  const crystalY = stageCenterY - 38 + floatBob;

  // Floating crystal glow aura
  const crystalGlow = ctx.createRadialGradient(
    crystalX,
    crystalY,
    2,
    crystalX,
    crystalY,
    26
  );
  crystalGlow.addColorStop(0, "rgba(192, 132, 252, 0.45)");
  crystalGlow.addColorStop(0.5, "rgba(147, 51, 234, 0.15)");
  crystalGlow.addColorStop(1, "rgba(126, 34, 206, 0)");
  ctx.fillStyle = crystalGlow;
  ctx.beginPath();
  ctx.arc(crystalX, crystalY, 26, 0, Math.PI * 2);
  ctx.fill();

  // Faceted crystal polygon (rhombus / gem)
  ctx.beginPath();
  ctx.moveTo(crystalX, crystalY - 12);     // Top apex
  ctx.lineTo(crystalX + 8, crystalY);      // Right apex
  ctx.lineTo(crystalX, crystalY + 12);     // Bottom apex
  ctx.lineTo(crystalX - 8, crystalY);      // Left apex
  ctx.closePath();
  ctx.fillStyle = "#8b5cf6";
  ctx.fill();
  ctx.strokeStyle = "#6d28d9";
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Facet highlights
  ctx.beginPath();
  ctx.moveTo(crystalX, crystalY - 12);
  ctx.lineTo(crystalX, crystalY + 12);
  ctx.strokeStyle = "rgba(255, 255, 255, 0.6)";
  ctx.lineWidth = 1;
  ctx.stroke();

  // Shiny white glint on top left facet
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.moveTo(crystalX - 1, crystalY - 8);
  ctx.lineTo(crystalX - 4, crystalY - 2);
  ctx.lineTo(crystalX - 1, crystalY);
  ctx.closePath();
  ctx.fill();

  // Orbiting crystal energy sparks
  for (let s = 0; s < 3; s++) {
    const sAngle = ticks * 0.05 + (s * (Math.PI * 2)) / 3;
    const sparkX = crystalX + Math.cos(sAngle) * 14;
    const sparkY = crystalY + Math.sin(sAngle) * 7;
    ctx.fillStyle = "#fef08a";
    ctx.fillRect(sparkX - 1, sparkY - 1, 2, 2);
  }
}

/**
 * Main Guild Environment Renderer
 *
 * Combines all 8 static and animated interior elements:
 * 1. Oak wood tavern floorboards, baseboards, and woven center runner rug.
 * 2. Cozy brick fireplace with chimney, grate, animated flames, embers, and warm light glow.
 * 3. Guild counter / tavern bar with oak grain, cider/ale barrels, and potion bottles.
 * 4. Guild notice board with pinned task parchments and wax seals.
 * 5. Ancient bookshelf and alchemy cabinet with spellbook spines and scrolls.
 * 6. 3 Research tables for specialist agents with manuscripts, candle flames, and inkpot quill.
 * 7. Guild gold vault chest with iron bands, corner brackets, padlock, and gold secured label.
 * 8. Strategy table with realm map, hovering magical crystal, and floor halo during bidding.
 */
export function drawGuildEnvironment(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  ticks: number,
  stagePhase: string,
  totalPayoutStr: string
): void {
  // 1. Floor & Architecture
  drawFloorAndArchitecture(ctx, width, height);

  // 2. Cozy Fireplace / Hearth (Center Back Wall)
  drawFireplace(ctx, width, ticks);

  // 3. Guild Counter / Tavern Bar (Left Wall)
  drawGuildCounter(ctx, width);

  // 4. Guild Notice Board (Mounted on Wall)
  drawNoticeBoard(ctx, width);

  // 5. Ancient Bookshelf & Alchemy Cabinet
  drawBookshelf(ctx, width);

  // 6. Specialist Research Tables (3 workstations)
  drawResearchTables(ctx, ticks);

  // 7. Guild Gold Vault (Top Right)
  drawGoldVault(ctx, width, totalPayoutStr);

  // 8. Guildmaster Strategy Table (Center Stage)
  drawStrategyTable(ctx, width, ticks, stagePhase);
}

/**
 * 9. BIDDING CONNECTIONS
 *
 * Subtle magical line pulses connecting the bidding agents to the strategy table:
 * - Rendered during 'bidding' and 'matched' stages.
 * - Glowing animated dashed vectors with traveling mana energy nodes.
 */
export function drawBiddingConnections(
  ctx: CanvasRenderingContext2D,
  stagePhase: string,
  geminiPos: { x: number; y: number },
  specialistPos: { x: number; y: number },
  tablePos: { x: number; y: number },
  ticks: number
): void {
  if (stagePhase !== "bidding" && stagePhase !== "matched") {
    return;
  }

  ctx.save();

  // Helper to draw an animated magical connection with traveling mana nodes
  const drawManaStream = (
    fromX: number,
    fromY: number,
    toX: number,
    toY: number,
    coreColor: string,
    glowColor: string
  ) => {
    // 1. Soft Outer Glowing Line
    ctx.strokeStyle = glowColor;
    ctx.lineWidth = 4;
    ctx.setLineDash([6, 6]);
    ctx.lineDashOffset = -ticks * 1.5;
    ctx.beginPath();
    ctx.moveTo(fromX, fromY);
    ctx.lineTo(toX, toY);
    ctx.stroke();

    // 2. Bright Inner Laser Line
    ctx.strokeStyle = coreColor;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(fromX, fromY);
    ctx.lineTo(toX, toY);
    ctx.stroke();

    // 3. Traveling Mana Energy Nodes along vector from worker to table
    const numNodes = 3;
    for (let i = 0; i < numNodes; i++) {
      const nodeProgress = ((ticks * 0.025 + i / numNodes) % 1);
      const nx = fromX + (toX - fromX) * nodeProgress;
      const ny = fromY + (toY - fromY) * nodeProgress;

      // Glow node
      ctx.fillStyle = coreColor;
      ctx.beginPath();
      ctx.arc(nx, ny, 3.5, 0, Math.PI * 2);
      ctx.fill();

      // White-hot center
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.arc(nx, ny, 1.5, 0, Math.PI * 2);
      ctx.fill();
    }
  };

  // Connection 1: Gemini (Scholar Teal) -> Strategy Table
  drawManaStream(
    geminiPos.x,
    geminiPos.y,
    tablePos.x,
    tablePos.y,
    "#6d8e9c",
    "rgba(109, 142, 156, 0.35)"
  );

  // Connection 2: Specialist (Ranger Green) -> Strategy Table
  drawManaStream(
    specialistPos.x,
    specialistPos.y,
    tablePos.x,
    tablePos.y,
    "#84a96e",
    "rgba(132, 169, 110, 0.35)"
  );

  // Soft reception pulse at the strategy table receiving node
  const pulseRadius = 7 + Math.sin(ticks * 0.15) * 3;
  ctx.strokeStyle = "rgba(212, 184, 106, 0.6)";
  ctx.lineWidth = 2;
  ctx.setLineDash([]);
  ctx.beginPath();
  ctx.arc(tablePos.x, tablePos.y, pulseRadius, 0, Math.PI * 2);
  ctx.stroke();

  ctx.restore();
}
