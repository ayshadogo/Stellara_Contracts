import { Body, Controller, Get, Param, Post, Put, Query } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { PrismaService } from '../prisma.service';
import { PaginationDto, paginate } from '../common/dto/pagination.dto';
import { EmailRetryTask } from './tasks/email-retry.task';

@Controller('notifications')
@Throttle({ default: { limit: 10, ttl: 60000 } })
export class NotificationController {
    constructor(
        private readonly prisma: PrismaService,
        private readonly emailRetryTask: EmailRetryTask,
    ) { }

    @Get('email-retry/dashboard')
    async getEmailRetryDashboard() {
        return this.emailRetryTask.getRetryDashboard();
    }

    @Get(':userId')
    async listNotifications(
        @Param('userId') userId: string,
        @Query() query: PaginationDto,
    ) {
        const { page, limit } = query;
        const skip = (page - 1) * limit;
        const [notifications, total] = await this.prisma.$transaction([
            this.prisma.notification.findMany({
                where: { userId },
                skip,
                take: limit,
                orderBy: { createdAt: 'desc' },
            }),
            this.prisma.notification.count({ where: { userId } }),
        ]);
        return paginate(notifications, total, page, limit);
    }

    @Get('settings/:userId')
    async getSettings(@Param('userId') userId: string) {
        return this.prisma.notificationSetting.upsert({
            where: { userId },
            update: {},
            create: { userId },
        });
    }

    @Put('settings/:userId')
    async updateSettings(
        @Param('userId') userId: string,
        @Body() settings: {
            emailEnabled?: boolean;
            pushEnabled?: boolean;
            notifyContributions?: boolean;
            notifyMilestones?: boolean;
            notifyDeadlines?: boolean;
        },
    ) {
        return this.prisma.notificationSetting.upsert({
            where: { userId },
            update: settings,
            create: {
                userId,
                ...settings,
            },
        });
    }

    @Post('subscribe/:userId')
    async subscribeToPush(
        @Param('userId') userId: string,
        @Body() subscription: any,
    ) {
        await this.prisma.user.update({
            where: { id: userId },
            data: { pushSubscription: subscription },
        });
        return { success: true };
    }
}
