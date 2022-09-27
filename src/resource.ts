export interface Resource {
  name: string;
  description: string;
  url: string;
  arn?: string;
}

export type ResourceType =
  | 'asg'
  | 'ASG'
  | 'bucket'
  | 'cluster'
  | 'database'
  | 'distribution'
  | 'function'
  | 'hosted zone'
  | 'instance'
  | 'parameter'
  | 'secret'
  | 'stack'
  | 'table';
