import { ObjectType, Field, ID } from '@nestjs/graphql';
import { User } from './user.type';

@ObjectType()
export class Project {
  @Field(() => ID)
  id: string;

  @Field()
  contractId: string;

  @Field()
  title: string;

  @Field({ nullable: true })
  description?: string;

  @Field()
  category: string;

  @Field(() => String)
  goal: string;

  @Field(() => String)
  currentFunds: string;

  @Field()
  status: string;

  @Field(() => User)
  creator: User;

  @Field(() => Date)
  deadline: Date;

  @Field(() => Date)
  createdAt: Date;
}
