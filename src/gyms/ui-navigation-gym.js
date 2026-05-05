export const uiNavigationGym = {
  id: 'ui-navigation-gym',
  name: 'UI Navigation Gym',
  source: 'gyms',
  categories: ['ui'],
  visibility: 'developer',
  description: 'Executable browser gym for Developer Mode, Scenario Browser visibility, and scene/event snapshots.',
  docs: [],
  tests: ['tests/gyms/ui-navigation.gym.spec.js'],
  covers: [
    'ui.developer-mode-toggle',
    'ui.scenario-browser-navigation',
    'ui.gym-api-snapshot'
  ],
  ci: true,
  composition: {
    type: 'executable-gym',
    stack: [{ scene: 'level', props: { gymId: 'ui-navigation-gym' } }]
  }
};
