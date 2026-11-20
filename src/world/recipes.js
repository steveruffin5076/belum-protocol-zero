// src/world/recipes.js - Task 6d Atomic Field Improvisation Recipes (Modern 2026 Survival-Stealth)
(function (global) {
  'use strict';

  const INPUT_LABELS = {
    emptyCan: 'Empty Can',
    pebbles: 'Pebbles',
    scrapWire: 'Scrap Wire',
    flare: 'Road Flare',
    rag: 'Cloth Rag',
    diesel: 'Diesel',
    radioParts: 'Radio Parts',
    battery: 'Battery'
  };

  const RECIPES = [
    {
      id: 'noisemaker_can',
      name: 'Noisemaker Can (+2)',
      inputs: { emptyCan: 1, pebbles: 1 },
      output: { ammo: { decoy: 2 } },
      use: 'Throw [4] to lure guards or provoke boars.'
    },
    {
      id: 'tripwire_flare',
      name: 'Tripwire Flare (+1)',
      inputs: { scrapWire: 1, flare: 1 },
      output: { inventory: { tripwireFlares: 1 } },
      use: 'Place [F] on a path. Alerts you, blinds guards for 3s, and provokes boars.'
    },
    {
      id: 'diesel_smoke_rag',
      name: 'Diesel Smoke Rag (+1)',
      inputs: { rag: 1, diesel: 1 },
      output: { inventory: { smokeRags: 1 } },
      use: 'Throw [G] for a 6s smoke screen that blocks vision cones.'
    },
    {
      id: 'radio_jammer',
      name: 'Radio Jammer (+1)',
      inputs: { radioParts: 2, battery: 1 },
      output: { inventory: { radioJammers: 1 } },
      use: 'Place [T] to stop guards calling allies for 20s.'
    }
  ];

  function getRecipeById(recipeId) {
    for (let i = 0; i < RECIPES.length; i++) {
      if (RECIPES[i].id === recipeId) return RECIPES[i];
    }
    return null;
  }

  function hasAllInputs(recipe, player) {
    if (!recipe || !player || !player.inventory) return { ok: false, missing: ['invalid'] };
    const inv = player.inventory;
    const missing = [];
    const keys = Object.keys(recipe.inputs);
    for (let i = 0; i < keys.length; i++) {
      const k = keys[i];
      const need = recipe.inputs[k];
      const have = Number.isFinite(inv[k]) ? inv[k] : 0;
      if (have < need) {
        missing.push(`${INPUT_LABELS[k] || k} (${have}/${need})`);
      }
    }
    return { ok: missing.length === 0, missing };
  }

  function getDiscoveredRecipes(player) {
    if (!player || !player.inventory) return [];
    const inv = player.inventory;
    if (!Array.isArray(player.discoveredRecipes)) {
      player.discoveredRecipes = [];
    }
    const discoveredSet = new Set(player.discoveredRecipes);
    const out = [];
    for (let i = 0; i < RECIPES.length; i++) {
      const r = RECIPES[i];
      let unlocked = discoveredSet.has(r.id);
      if (!unlocked) {
        const keys = Object.keys(r.inputs);
        for (let j = 0; j < keys.length; j++) {
          if ((inv[keys[j]] || 0) > 0) {
            unlocked = true;
            discoveredSet.add(r.id);
            player.discoveredRecipes.push(r.id);
            break;
          }
        }
      }
      if (unlocked) out.push(r);
    }
    return out;
  }

  /**
   * Atomic field improvisation: validates ALL inputs before mutating ANY state.
   * On any missing input, leaves player.inventory and player.ammo completely unchanged.
   */
  function craftRecipe(recipeId, player) {
    const recipe = getRecipeById(recipeId);
    if (!recipe || !player || !player.inventory) {
      return { ok: false, missing: ['unknown_recipe'], message: 'Unknown field recipe.' };
    }
    const check = hasAllInputs(recipe, player);
    if (!check.ok) {
      return {
        ok: false,
        missing: check.missing,
        message: `Missing inputs for ${recipe.name}: ${check.missing.join(', ')}`
      };
    }

    // Atomic deduction + grant
    const inv = player.inventory;
    const inKeys = Object.keys(recipe.inputs);
    for (let i = 0; i < inKeys.length; i++) {
      const k = inKeys[i];
      inv[k] = (inv[k] || 0) - recipe.inputs[k];
    }
    if (recipe.output.ammo && player.ammo) {
      const aKeys = Object.keys(recipe.output.ammo);
      for (let i = 0; i < aKeys.length; i++) {
        const k = aKeys[i];
        player.ammo[k] = (player.ammo[k] || 0) + recipe.output.ammo[k];
      }
    }
    if (recipe.output.inventory) {
      const oKeys = Object.keys(recipe.output.inventory);
      for (let i = 0; i < oKeys.length; i++) {
        const k = oKeys[i];
        inv[k] = (inv[k] || 0) + recipe.output.inventory[k];
      }
    }
    return {
      ok: true,
      recipe,
      message: `Improvised ${recipe.name}. ${recipe.use}`
    };
  }

  function formatRecipeInputs(recipe, player) {
    const inv = (player && player.inventory) || {};
    return Object.keys(recipe.inputs)
      .map((k) => `${INPUT_LABELS[k] || k} ${inv[k] || 0}/${recipe.inputs[k]}`)
      .join(' + ');
  }

  const FieldRecipes = {
    RECIPES,
    INPUT_LABELS,
    getRecipeById,
    hasAllInputs,
    getDiscoveredRecipes,
    craftRecipe,
    formatRecipeInputs
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = FieldRecipes;
  }
  global.BelumGame = global.BelumGame || {};
  global.BelumGame.FieldRecipes = FieldRecipes;
})(typeof window !== 'undefined' ? window : globalThis);
