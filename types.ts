
export interface Obstacle {
  id: string;
  text: string;
}

export interface IntermediateObjective {
  id: string;
  obstacleId: string;
  text: string;
  type: 'condition' | 'action';
  prerequisites: string[]; // IDs of other IOs
}

export interface ActionPlan {
  id: string;
  ioId: string;
  task: string;
  who: string;
  when: string;
}

export interface TreeData {
  target: string;
  obstacles: Obstacle[];
  ios: IntermediateObjective[];
  actions: ActionPlan[];
}

export enum AppStep {
  TARGET = 1,
  OBSTACLES = 2,
  IOS = 3,
  SEQUENCE = 4,
  ACTION_PLAN = 5,
  FINAL_VIEW = 6
}
