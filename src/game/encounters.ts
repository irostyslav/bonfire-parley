import type { Encounter, ParleyResult } from "./types";

export const ENCOUNTERS: Encounter[] = [
  {
    id: "widow",
    title: "A woman by the coals",
    body: "She does not look up. Snow has settled in her hair like ash. “If you have come from the south road,” she says, “tell me you passed a boy with a red scarf.”",
    choices: [
      { id: "share", label: "Share your bread and sit" },
      { id: "truth", label: "Admit you saw no one" },
      { id: "leave", label: "Keep walking" },
    ],
  },
  {
    id: "soldier",
    title: "A man in ruined mail",
    body: "His sword is a stick of ice. He watches the bundle on your back as if it were a second fire. “That thing you carry,” he says. “It has a smell. Give it here and I will see you fed.”",
    choices: [
      { id: "refuse", label: "The burden is yours" },
      { id: "trade", label: "Trade a little food for passage" },
      { id: "give", label: "Set the relic in the snow" },
    ],
  },
  {
    id: "mute",
    title: "Someone who will not speak",
    body: "They tend a small, stubborn flame with both hands. When you approach they only shift, making room on the log. The wind lessens, as if embarrassed.",
    choices: [
      { id: "sit", label: "Sit in the silence" },
      { id: "food", label: "Leave bread without a word" },
      { id: "leave", label: "Nod and go" },
    ],
  },
  {
    id: "pilgrim",
    title: "A pilgrim with a cracked lantern",
    body: "“The valley pinches ahead,” she says. “Storm in the teeth of the hills. Rest here and I will mark you a lower path. Or press on, if you prefer your own freeze.”",
    choices: [
      { id: "rest", label: "Rest and take the lower path" },
      { id: "press", label: "Press on" },
      { id: "ask", label: "Ask who she is walking toward" },
    ],
  },
  {
    id: "child",
    title: "A child and a dying fire",
    body: "The fire is almost gossip now. The child has no gloves. They look at your pack, then at your face. “Are you going where it is warm?”",
    choices: [
      { id: "coat", label: "Give them your extra wool" },
      { id: "food", label: "Leave what food you can" },
      { id: "cannot", label: "You cannot take them" },
    ],
  },
  {
    id: "merchant",
    title: "A cart with no horse",
    body: "He has arranged tins and bones as if they were wares. “I deal in weight,” he says, delighted. “A charm against what you carry. Cheap, if you still have a story left.”",
    choices: [
      { id: "charm", label: "Buy the charm with food" },
      { id: "story", label: "Tell him nothing true" },
      { id: "leave", label: "The cart is empty. Leave" },
    ],
  },
  {
    id: "priest",
    title: "The last fire",
    body: "A ring of black stones. A fire that does not smoke. The figure inside the ring is only a suggestion of a person. “You may set it down,” they say. “Or you may carry it into the white, and see which of you is the burden.”",
    choices: [
      { id: "down", label: "Set the relic in the ring" },
      { id: "carry", label: "Carry it into the white" },
      { id: "ask", label: "Ask what it was for" },
    ],
  },
];

export function resolveParley(id: string, choice: string, hasRelic: boolean): ParleyResult {
  if (id === "widow") {
    if (choice === "share")
      return {
        body: "You split the heel of bread. She eats as if remembering how. When you rise, the fire has learned your names.",
        food: -1,
        warmth: 28,
        stamina: 20,
      };
    if (choice === "truth")
      return {
        body: "She nods once, a door closing. “Then he is still ahead of you. Or behind. It is the same road.”",
        warmth: 12,
      };
    return { body: "Her silence follows you further than her voice would have.", warmth: 4 };
  }

  if (id === "soldier") {
    if (choice === "give" && hasRelic)
      return {
        body: "The bundle leaves your shoulders. For a moment you are only a person in the snow. Then the cold, which had been waiting, comes in.",
        relic: false,
        food: 2,
        warmth: -18,
        ending: "relinquish",
      };
    if (choice === "trade")
      return {
        body: "He takes a tin and does not take the rest. You are permitted to pass. His eyes stay on your back until the trees close.",
        food: -1,
        warmth: 8,
      };
    return {
      body: "He laughs without humour. “Keep it, then. May it learn your walk.”",
      warmth: 6,
    };
  }

  if (id === "mute") {
    if (choice === "sit")
      return {
        body: "You sit. Nothing is said. The fire makes the only argument. When you leave, your hands remember being warm.",
        warmth: 40,
        stamina: 35,
      };
    if (choice === "food")
      return {
        body: "You set bread on the log. They do not thank you. The flame leans toward it as if it were a guest.",
        food: -1,
        warmth: 18,
      };
    return { body: "A nod is a whole language, if you are tired enough.", warmth: 8 };
  }

  if (id === "pilgrim") {
    if (choice === "rest")
      return {
        body: "She scratches a line in the frost: a hook of a path, hugging the creek. The wind, for a mile, is less of a thief.",
        warmth: 30,
        stamina: 25,
      };
    if (choice === "ask")
      return {
        body: "“Toward whoever still lights a fire,” she says. “Same as you.” She smiles as if that were a joke that had survived the world.",
        warmth: 16,
      };
    return { body: "She watches you go the hard way, and does not call you back.", warmth: 5 };
  }

  if (id === "child") {
    if (choice === "coat")
      return {
        body: "The wool is too large. They become a small tent. You will be colder. That is the arithmetic.",
        warmth: -22,
        stamina: 10,
      };
    if (choice === "food")
      return {
        body: "They eat standing up, the way the hungry do. You do not wait to see if it is enough.",
        food: -1,
        warmth: 10,
      };
    return {
      body: "You say it as kindly as the language allows. They already knew. Children always know first.",
      warmth: 4,
    };
  }

  if (id === "merchant") {
    if (choice === "charm")
      return {
        body: "A ring of black wire. It is almost nothing. The pack, somehow, argues less with your spine.",
        food: -1,
        charm: true,
        warmth: 10,
      };
    if (choice === "story")
      return {
        body: "You tell him the snow is a kind of letter, and no one left to read it. He weeps, professionally, and gives you a tin.",
        food: 1,
        warmth: 8,
      };
    return { body: "The cart, in fairness, was always empty.", warmth: 3 };
  }

  if (id === "priest") {
    if (choice === "down")
      return {
        body: "You set it among the stones. The fire accepts it without comment. For the first time in a long walk, you are not carrying the century.",
        relic: false,
        ending: "relinquish",
      };
    if (choice === "carry")
      return {
        body: "The white does not part. It simply continues, and you continue with it, pack and all, until the idea of stopping becomes a rumour.",
        ending: "endure",
      };
    return {
      body: "“It was for remembering,” they say. “Which is why no one wanted it.” The fire waits. It has time.",
      warmth: 20,
    };
  }

  return { body: "The fire says nothing more." };
}

export function encounterForDistance(distance: number, used: Set<string>): Encounter | null {
  const order = ["widow", "mute", "soldier", "pilgrim", "child", "merchant", "priest"];
  const idx = Math.min(order.length - 1, Math.floor(distance / 95));
  for (let i = idx; i >= 0; i--) {
    const id = order[i]!;
    if (!used.has(id)) return ENCOUNTERS.find((e) => e.id === id) ?? null;
  }
  return null;
}
