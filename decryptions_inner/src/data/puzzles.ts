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

export const currentPuzzle = getCurrentPuzzle();
