import { Module } from '@nestjs/common';
import { GraphQLModule } from '@nestjs/graphql';
import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import { join } from 'path';
import { ProjectResolver } from './resolvers/project.resolver';
import { ContributionResolver } from './resolvers/contribution.resolver';
import { PrismaService } from '../prisma.service';

@Module({
  imports: [
    GraphQLModule.forRoot<ApolloDriverConfig>({
      driver: ApolloDriver,
      autoSchemaFile: join(process.cwd(), 'src/schema.gql'),
      sortSchema: true,
      playground: true,
      subscriptions: {
        'graphql-ws': true,
      },
    }),
  ],
  providers: [ProjectResolver, ContributionResolver, PrismaService],
})
export class StellaraGraphQLModule {}
