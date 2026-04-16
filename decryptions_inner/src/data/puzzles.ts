export interface PuzzleClue {
  type: "image" | "text" | "symbol" | "operator";
  content: string;
  alt?: string;
}

export interface PuzzleWord {
  answer: string;
  clues: PuzzleClue[];
}

export interface Puzzle {
  id: string;
  date: string;
  category: string;
  headline: string;
  words: PuzzleWord[];
  hints: string[];
}

export const puzzles: Puzzle[] = [
  {
    id: "2026-04-16-virginia-ex-lieutenant-governor-kills-wife",
    headline: "Virginia Ex Lieutenant Governor Kills Wife",
    date: "April 16, 2026",
    category: "U.S. News",
    words: [
      {
        answer: "VIRGINIA",
        clues: [{ type: "image", content: "/virginia-outline.png", alt: "Virginia state outline" }],
      },
      {
        answer: "EX",
        clues: [
          { type: "operator", content: "(" },
          { type: "image", content: "/sex-gender-symbols.png", alt: "Gender symbols" },
          { type: "operator", content: " - " },
          { type: "image", content: "/s-cursive.png", alt: "Cursive s" },
          { type: "operator", content: ")" },
        ],
      },
      {
        answer: "LIEUTENANT",
        clues: [
          { type: "operator", content: "(" },
          { type: "image", content: "/lion.png", alt: "Lion" },
          { type: "operator", content: " - " },
          { type: "image", content: "/on-switch.png", alt: "On switch" },
          { type: "operator", content: ") + " },
          { type: "image", content: "/eu-flag.png", alt: "EU flag" },
          { type: "operator", content: " + " },
          { type: "image", content: "/roman-ten.png", alt: "Roman numeral ten" },
          { type: "operator", content: " + " },
          { type: "image", content: "/ant.png", alt: "Ant" },
        ],
      },
      {
        answer: "GOVERNOR",
        clues: [
          { type: "operator", content: "(" },
          { type: "image", content: "/gold-au.png", alt: "Gold Au on periodic table" },
          { type: "operator", content: " - " },
          { type: "image", content: "/ld-cursive.svg", alt: "Cursive ld" },
          { type: "operator", content: ") + (" },
          { type: "image", content: "/verizon-v.png", alt: "Verizon logo" },
          { type: "operator", content: " - " },
          { type: "text", content: "izon" },
          { type: "operator", content: ")" },
        ],
      },
      {
        answer: "KILLS",
        clues: [
          { type: "operator", content: "(" },
          { type: "image", content: "/kiwi.png", alt: "Kiwi fruit" },
          { type: "operator", content: " - " },
          { type: "image", content: "/wii.png", alt: "Nintendo Wii" },
          { type: "operator", content: ") + (" },
          { type: "image", content: "/llama.png", alt: "Llama" },
          { type: "operator", content: " - " },
          { type: "text", content: "ama" },
          { type: "operator", content: ") + " },
          { type: "text", content: "s" },
        ],
      },
      {
        answer: "WIFE",
        clues: [
          { type: "operator", content: "(" },
          { type: "image", content: "/wig.png", alt: "Wig" },
          { type: "operator", content: " - " },
          { type: "text", content: "g" },
          { type: "operator", content: ") + " },
          { type: "text", content: "fe" },
        ],
      },
    ],
    hints: [
      "East Coast state",
      "(Gender term - S)",
      "(Big cat - switch word) + EU + ten + insect",
      "(Chemical symbol - ld) + (phone company logo - izon)",
      "(Green fruit - game console) + (Pack animal - ama) + s",
      "(Hairpiece - G) + FE",
    ],
  },
  {
    id: "2026-04-14-trump-attacks-pope-leo",
    headline: "Trump Attacks Pope Leo",
    date: "April 14, 2026",
    category: "World News",
    words: [
      {
        answer: "TRUMP",
        clues: [
          { type: "image", content: "/tea.png", alt: "Tea" },
          { type: "operator", content: " + (" },
          { type: "image", content: "/drum.png", alt: "Drum" },
          { type: "operator", content: " - " },
          { type: "text", content: "d" },
          { type: "operator", content: ") + " },
          { type: "image", content: "/pea.png", alt: "Pea" },
        ],
      },
      {
        answer: "ATTACKS",
        clues: [
          { type: "operator", content: "(" },
          { type: "image", content: "/bat-attacks.png", alt: "Bat" },
          { type: "operator", content: " - " },
          { type: "image", content: "/bee.png", alt: "Bee" },
          { type: "operator", content: ") + (" },
          { type: "image", content: "/tictac.png", alt: "Tic Tac" },
          { type: "operator", content: " - " },
          { type: "image", content: "/tick.png", alt: "Tick" },
          { type: "operator", content: ") + " },
          { type: "text", content: "ks" },
        ],
      },
      {
        answer: "POPE",
        clues: [
          { type: "operator", content: "(" },
          { type: "image", content: "/hippo.png", alt: "Hippo" },
          { type: "operator", content: " - " },
          { type: "image", content: "/hip.png", alt: "Hip" },
          { type: "operator", content: ") + (" },
          { type: "image", content: "/ape.png", alt: "Ape" },
          { type: "operator", content: " - " },
          { type: "text", content: "a" },
          { type: "operator", content: ")" },
        ],
      },
      {
        answer: "LEO",
        clues: [
          { type: "operator", content: "(" },
          { type: "image", content: "/cable.png", alt: "Cable" },
          { type: "operator", content: " - " },
          { type: "image", content: "/cab.png", alt: "Taxi cab" },
          { type: "operator", content: ") + " },
          { type: "image", content: "/asl-o.png", alt: "ASL letter O" },
        ],
      },
    ],
    hints: [
      "Hot drink + (instrument − D) + green vegetable",
      "(Flying mammal − B) + (mint candy − tick) + ks",
      "(Large animal − hip) + (primate − A)",
      "(Cable − cab) + O",
    ],
  },
  {
    id: "2026-04-13-trump-hormuz",
    headline: "Trump to Block Hormuz",
    date: "April 13, 2026",
    category: "World News",
    words: [
      {
        answer: "TRUMP",
        clues: [
          { type: "operator", content: "(" },
          { type: "image", content: "/trumpet.png", alt: "Trumpet" },
          { type: "operator", content: " - " },
          { type: "image", content: "/et.png", alt: "E.T." },
          { type: "operator", content: ")" },
        ],
      },
      {
        answer: "TO",
        clues: [{ type: "image", content: "/ii.png", alt: "Roman numeral II" }],
      },
      {
        answer: "BLOCK",
        clues: [
          { type: "operator", content: "(" },
          { type: "image", content: "/blink.png", alt: "Blink" },
          { type: "operator", content: " - " },
          { type: "image", content: "/ink.png", alt: "Ink" },
          { type: "operator", content: ") + (" },
          { type: "image", content: "/clock.png", alt: "Clock" },
          { type: "operator", content: " - " },
          { type: "text", content: "cl" },
          { type: "operator", content: ")" },
        ],
      },
      {
        answer: "HORMUZ",
        clues: [
          { type: "operator", content: "(" },
          { type: "image", content: "/hornet.png", alt: "Hornet" },
          { type: "operator", content: " - " },
          { type: "image", content: "/net.png", alt: "Net" },
          { type: "operator", content: ") + (" },
          { type: "image", content: "/mug.png", alt: "Mug" },
          { type: "operator", content: " - " },
          { type: "image", content: "/g.png", alt: "g" },
          { type: "operator", content: ") + " },
          { type: "image", content: "/z.png", alt: "z" },
        ],
      },
    ],
    hints: [
      "Brass instrument in an orchestra - Extra-terrestrial, for short",
      "The number after one (Roman numerals)",
      "(A quick eye movement - What comes out of a pen) + (Tells time - First two letters of 'class')",
      "(A stinging insect - A mesh trap) + (A coffee cup - its last letter) + z",
    ],
  },
  {
    id: "2026-04-11",
    headline: "Melania Denies Epstein Ties",
    date: "April 11, 2026",
    category: "World News",
    words: [
      {
        answer: "MELANIA",
        clues: [
          { type: "operator", content: "(" },
          { type: "image", content: "/caramel.png", alt: "Caramel" },
          { type: "operator", content: "- CARA) + (" },
          { type: "image", content: "/fan.png", alt: "Fan" },
          { type: "operator", content: "- f) + IA" },
        ],
      },
      {
        answer: "DENIES",
        clues: [
          { type: "image", content: "/den.png", alt: "Den" },
          { type: "operator", content: " + " },
          { type: "image", content: "/eyes2.jpg", alt: "Eyes" },
        ],
      },
      {
        answer: "EPSTEIN",
        clues: [
          { type: "operator", content: "(" },
          { type: "image", content: "/bicep.png", alt: "Bicep" },
          { type: "operator", content: "-" },
          { type: "image", content: "/bic.png", alt: "bic" },
          { type: "operator", content: ") + (" },
          { type: "image", content: "/stem.png", alt: "Stem" },
          { type: "operator", content: "- m) + (" },
          { type: "image", content: "/tin.png", alt: "Tin" },
          { type: "operator", content: "- t)" },
        ],
      },
      {
        answer: "TIES",
        clues: [{ type: "image", content: "/ties4.png", alt: "Ties" }],
      },
    ],
    hints: [
      "(A chewy candy - first four letters) + (team devotee - sixth letter in alphabet) + 2001 Spielberg film backwards",
      "Dad's refuge + spiders can't blink theirs",
      "(Flexible muscle - pen company) + (sunflower's stalk - m) + (metal in bronze, often - it comes in small bags)",
      "Bolos and ascots",
    ],
  },
  {
    id: "2025-10-20-french-treasures-stolen",
    headline: "French Treasures Stolen",
    date: "October 20, 2025",
    category: "World News",
    words: [
      {
        answer: "FRENCH",
        clues: [
          { type: "operator", content: "(" },
          {
            type: "image",
            content:
              "https://media.istockphoto.com/id/542571172/vector/golden-vector-frame-with-stucco-ornaments.jpg?s=612x612&w=0&k=20&c=LnADI8S-hvUIUit4NLXubVYiMw_KYNPE005gJxqXDnM=",
            alt: "Frame",
          },
          { type: "operator", content: "-" },
          {
            type: "image",
            content:
              "https://www.nicepng.com/png/detail/261-2613212_aim-bow-and-arrow-clipart-aim-clipart.png",
            alt: "Ame",
          },
          { type: "operator", content: ") + (" },
          {
            type: "image",
            content:
              "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSdsMSYpOKgFe4eWnexSHxJFDY3uKQOHxIYhw&s",
            alt: "Bench",
          },
          { type: "operator", content: "-" },
          {
            type: "image",
            content:
              "https://i.etsystatic.com/13434992/r/il/3bf90f/3219303725/il_fullxfull.3219303725_kovf.jpg",
            alt: "Bee",
          },
          { type: "operator", content: ")" },
        ],
      },
      {
        answer: "TREASURES",
        clues: [
          { type: "operator", content: "(" },
          {
            type: "image",
            content:
              "https://images.rawpixel.com/image_800/cHJpdmF0ZS9sci9pbWFnZXMvd2Vic2l0ZS8yMDIyLTA1L2pvYjcyNS0wMzYuanBn.jpg",
            alt: "Tread",
          },
          { type: "operator", content: "- AD) + (" },
          {
            type: "image",
            content:
              "https://media.istockphoto.com/id/1212944319/vector/flat-design-of-happy-surfer-boy.jpg?s=612x612&w=0&k=20&c=1ejj72eVjVlBcDSKSLoq48UkajCPXxqkm3xEjNBh2o8=",
            alt: "Surfer",
          },
          { type: "operator", content: "-" },
          {
            type: "image",
            content:
              "https://gallery.yopriceville.com/var/albums/Backgrounds/Fur_Background.jpg?m=1629744982",
            alt: "Fur",
          },
          { type: "operator", content: ") + ES" },
        ],
      },
      {
        answer: "STOLEN",
        clues: [
          { type: "operator", content: "(" },
          {
            type: "image",
            content:
              "https://media.istockphoto.com/id/1221686500/vector/stop-sign-red-forbidding-sign-with-human-hand-in-octagon-shape-stop-hand-gesture-do-not.jpg?s=612x612&w=0&k=20&c=gl2IwI_EhZKrhb0SYBwAY4Mw4B9xtcJXvJUhZgK7bUM=",
            alt: "Stop",
          },
          { type: "operator", content: "-" },
          {
            type: "image",
            content:
              "https://media.istockphoto.com/id/1458175482/vector/cute-peas-cartoon-icon-illustration-food-vegetable-flat-icon-concept-isolated.jpg?s=612x612&w=0&k=20&c=fyA5bjkDw3-Xv8f8iTHxOvqQ8YguoCiJx0G8wBl9X3c=",
            alt: "Pea",
          },
          { type: "operator", content: ") + (" },
          {
            type: "image",
            content:
              "https://www.shutterstock.com/image-vector/icon-camera-lens-white-background-600nw-99766226.jpg",
            alt: "Lens",
          },
          { type: "operator", content: "- S)" },
        ],
      },
    ],
    hints: [
      "First word: (Word with picture or freeze without the thing you must do for target practice) + (A river crossing without the event for spellers)",
      "Second word: ('Don't ___ on me' (Revolutionary flag motto) without the last two letters) + (a board rider without dog's hair) + ES",
      "Third word: ('Quit doing that!' without a word with soup or shooter) + (part of an eye or camera minus S)",
    ],
  },
];

const formatPuzzleDate = (date: Date): string => {
  return date.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
};

export const getCurrentPuzzle = (today: Date = new Date()): Puzzle => {
  const todayKey = formatPuzzleDate(today);
  return puzzles.find((puzzle) => puzzle.date === todayKey) ?? puzzles[0];
};

/** Puzzles for archive UI: newest first (ids begin with ISO dates). */
export function getArchivedPuzzlesSorted(): Puzzle[] {
  return [...puzzles].sort((a, b) => b.id.localeCompare(a.id));
}

/** Archive list: past puzzles only (excludes the current daily puzzle). */
export function getArchiveListPuzzles(today: Date = new Date()): Puzzle[] {
  const currentId = getCurrentPuzzle(today).id;
  return getArchivedPuzzlesSorted().filter((p) => p.id !== currentId);
}

export const currentPuzzle = getCurrentPuzzle();
