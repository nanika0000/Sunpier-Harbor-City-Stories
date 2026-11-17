// The story: five chapters for Mika Sol, delivery rider for her aunt Rosa's noodle shop,
// each a chain of stages over the town's landmarks. A stage is a target the player must
// reach (on foot or in a car, some in one specific car), with lines of dialogue at the
// start and the end. Finishing a chapter pays, saves, and points at the next one; running
// out of time sends the player back to the chapter's start with nothing but the lesson.
import { HEAT } from './config.js';

const L = (who, text) => ({ who, text });

/**
 * Stage helpers. Every stage: { label, target(game) -> {x,y}, done(game), onStart?(game) }.
 * `reach` is the everyday stage; the story's twists (steal this car, carry that box) are
 * small predicates over the game state.
 */
function reach(x, y, r = 58) {
  return {
    target: () => ({ x, y }),
    done: (game) => {
      const p = game.player.mode === 'car' && game.player.car ? game.player.car : game.player;
      return Math.hypot(p.x - x, p.y - y) < r;
    },
  };
}

function reachInCar(x, y, car, r = 66) {
  return {
    target: () => (car && !car.dead ? { x: car.x, y: car.y } : { x, y }),
    done: (game) => {
      if (game.player.mode !== 'car' || game.player.car !== car) return false;
      return Math.hypot(car.x - x, car.y - y) < r;
    },
  };
}

// The stages reference landmarks, which only exist once the world is generated, so the
// table is built by buildMissions(world) at boot. The Tanaka house stands on the avenue
// at (2400, 688): its front step is on the road's edge, always reachable.
export function buildMissions(world) {
  const lm = world.landmarks;
  const house = { x: 2400, y: 688 };
  return [
    {
      title: 'Chapter 1 — First Run',
      reward: 150,
      time: 100,
      giver: lm.noodle,
      intro: [
        L('Aunt Rosa', 'Mika! There you are. The Tanaka order is getting cold.'),
        L('Mika', 'One noodle run across town. Easy money, right?'),
        L('Aunt Rosa', 'East side, past the clinic. And Mika — no shortcuts through gardens.'),
      ],
      outro: [
        L('Mrs. Tanaka', 'Still warm! Your aunt said you were quick.'),
        L('Mika', 'First run done. Maybe this town pays after all.'),
      ],
      stages: [
        { label: 'Pick up the noodles at Rosa\'s Noodles', ...reach(lm.noodle.doorX, lm.noodle.doorY, 52) },
        { label: 'Deliver to the Tanaka house (east side)', ...reach(house.x, house.y, 62) },
      ],
    },
    {
      title: 'Chapter 2 — Paint Run',
      reward: 220,
      time: 135,
      giver: lm.mural,
      intro: [
        L('Juno', 'You\'re Rosa\'s rider? I need cans from the paint shop by the wall, then the wall itself.'),
        L('Mika', 'The Harbor Wall? That mural is famous.'),
        L('Juno', 'It fades a little more every summer. Help me keep it alive. Mind the shop alarm.'),
      ],
      outro: [
        L('Juno', 'Look at that colour come back. The whole harbour will see it.'),
        L('Mika', 'Worth a little alarm bell.'),
      ],
      stages: [
        {
          label: 'Collect the spray cans at Paint Supply',
          ...reach(lm.mural.doorX, lm.mural.doorY + 190, 56),
          onArrive: (game) => { game.addHeat(10, lm.mural.doorX, lm.mural.doorY + 190); game.toast('The shop alarm chirps — someone noticed.'); },
        },
        { label: 'Bring the cans to the Harbor Wall', ...reach(lm.mural.doorX, lm.mural.doorY, 62) },
      ],
    },
    {
      title: 'Chapter 3 — Quiet Cargo',
      reward: 320,
      time: 125,
      giver: lm.clinic,
      intro: [
        L('Dr. Ito', 'This cooler goes to the Pier 9 warehouse. No questions, no stops.'),
        L('Mika', 'A clinic sending mystery coolers to a warehouse. Normal town.'),
        L('Dr. Ito', 'It is medicine, Mika. Just… drive like it matters.'),
      ],
      outro: [
        L('Dockhand Ren', 'Clinic cooler? Sign here. You didn\'t open it, right?'),
        L('Mika', 'Didn\'t even shake it. Much.'),
      ],
      stages: [
        { label: 'Pick up the cooler at Sunpier Clinic', ...reach(lm.clinic.doorX, lm.clinic.doorY, 54) },
        { label: 'Deliver the cooler to Pier 9 Warehouse', ...reach(lm.warehouse.doorX, lm.warehouse.doorY, 66) },
      ],
    },
    {
      title: 'Chapter 4 — Hot Wheels',
      reward: 450,
      time: 155,
      giver: lm.gullwingLot,
      intro: [
        L('Unknown number', 'Marina Parking. Yellow Gullwing, plates covered. Bring it to Sol Garage.'),
        L('Mika', '…This is a crime. An actual crime.'),
        L('Unknown number', 'It is a debt being collected. The alarm, however, is very real. Run.'),
      ],
      outro: [
        L('Sol', 'She\'s beautiful. And you outran the whole pier watch. Debt settled, rider.'),
        L('Mika', 'I am never answering unknown numbers again.'),
      ],
      stages: [
        {
          label: 'Steal the yellow Gullwing at Marina Parking',
          target: (game) => (game.gullwing ? { x: game.gullwing.x, y: game.gullwing.y } : lm.gullwingLot),
          done: (game) => game.player.mode === 'car' && game.player.car === game.gullwing,
          onStart: (game) => { game.toast('The yellow Gullwing waits in Marina Parking.'); },
        },
        {
          label: 'Deliver the Gullwing to Sol Garage',
          target: () => lm.hideout,
          done: (game) => game.player.mode === 'car' && game.player.car === game.gullwing
            && Math.hypot(game.gullwing.x - lm.hideout.doorX, game.gullwing.y - lm.hideout.doorY) < 74,
        },
      ],
    },
    {
      title: 'Chapter 5 — Sunset Ledger',
      reward: 650,
      time: 145,
      giver: lm.warehouse,
      intro: [
        L('Dockhand Ren', 'The harbour ledger. Every debt, every favour, thirty years of Sunpier.'),
        L('Mika', 'And it goes to… the lighthouse?'),
        L('Ren', 'Keeper Aoi archives everything. Before sunset, rider. Half the town will chase this book.'),
      ],
      outro: [
        L('Keeper Aoi', 'Thirty years of Sunpier, safe in the light. You carry this town well, Mika.'),
        L('Mika', 'From noodle runs to town history. Aunt Rosa is never going to believe me.'),
      ],
      stages: [
        {
          label: 'Pick up the ledger at Pier 9 Warehouse',
          ...reach(lm.warehouse.doorX, lm.warehouse.doorY, 60),
          onArrive: (game) => { game.addHeat(HEAT.theftQuiet + 14, lm.warehouse.doorX, lm.warehouse.doorY); game.toast('Someone is watching from the docks…'); },
        },
        { label: 'Take the ledger to Sunpier Lighthouse', ...reach(lm.lighthouse.doorX, lm.lighthouse.doorY, 64) },
      ],
    },
  ];
}

/**
 * Mission flow, driven from main.js. game.mission is null between chapters; starting a
 * chapter shows its intro dialogue first, then the stages run against the clock.
 */
export function startMission(game, index) {
  const def = game.missionDefs[index];
  if (!def) return;
  game.mission = {
    index, def, stage: 0, timer: def.time, state: 'intro', failed: false,
  };
  game.showDialogue(def.intro, () => {
    game.mission.state = 'run';
    def.stages[0].onStart?.(game);
    game.toast(def.title);
  });
}

export function updateMission(game, dt) {
  const mission = game.mission;
  if (!mission || mission.state !== 'run') return;
  mission.timer -= dt;
  if (mission.timer <= 0) {
    mission.state = 'failed';
    game.showDialogue([
      L('Mika', 'Too late. The moment is gone… I\'ll have to start this one over.'),
    ], () => {
      game.mission = null;
      game.respawnAtGiver(mission);
    });
    game.audio?.fail();
    return;
  }
  const stage = mission.def.stages[mission.stage];
  if (!stage.done(game)) return;
  stage.onArrive?.(game);
  game.audio?.pickup();
  mission.stage += 1;
  if (mission.stage < mission.def.stages.length) {
    mission.def.stages[mission.stage].onStart?.(game);
    return;
  }
  // Chapter complete: pay, save, point onward.
  game.cash += mission.def.reward;
  game.audio?.complete();
  game.mission = null;
  game.progress.missionIndex = mission.index + 1;
  game.progress.cash = game.cash;
  game.saveProgress();
  const next = game.missionDefs[mission.index + 1];
  game.showDialogue(mission.def.outro, () => {
    if (next) game.toast(`Next: ${next.title} — $${next.reward}`);
    else {
      game.progress.storyDone = true;
      game.saveProgress();
      game.onStoryComplete();
    }
  });
}

/** The current objective marker, or null when no stage is running. */
export function currentTarget(game) {
  const mission = game.mission;
  if (!mission || mission.state !== 'run') return null;
  return mission.def.stages[mission.stage].target(game);
}

/** Where the next chapter begins, for the between-chapters marker. */
export function nextGiver(game) {
  if (game.mission) return null;
  const def = game.missionDefs[game.progress.missionIndex];
  return def ? def.giver : null;
}
