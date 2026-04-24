import { ObjectType, Field, ID } from '@nestjs/graphql';
import { User } from './user.type';
import { Project } from './project.type';

@ObjectType()
export class Contribution {
  @Field(() => ID)
  id: string;

  @Field()
  transactionHash: string;

  @Field(() => String)
  amount: string;

  @Field(() => User)
  investor: User;

  @Field(() => Project)
  project: Project;

  @Field(() => Date)
  timestamp: Date;

  @Field(() => Date)
  createdAt: Date;
}
