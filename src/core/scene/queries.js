export function getComponent(object, type) {
  return object?.components?.find(component => component.type === type) ?? null;
}

export function getComponents(object, type) {
  return object?.components?.filter(component => component.type === type) ?? [];
}

export function findObjectsWithComponent(scene, type) {
  return scene?.componentIndex?.[type] ?? [];
}

export function findOneObjectWithComponent(scene, type) {
  return findObjectsWithComponent(scene, type)[0] ?? null;
}
