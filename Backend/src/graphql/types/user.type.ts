import { ObjectType, Field, ID, Int } from '@nestjs/graphql';

@ObjectType()
export class User {
  @Field(() => ID)
  id: string;

  @Field()
  walletAddress: string;

  @Field(() => Int)
  reputationScore: number;

  @Field(() => String)
  reputationLevel: string;

  @Field(() => Date)
  createdAt: Date;
}
