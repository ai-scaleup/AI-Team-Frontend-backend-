import {
  BadRequestException,
  Controller,
  Post,
  Headers,
  RawBodyRequest,
  Req,
  Res,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiBody,
  ApiHeader,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Request, Response } from 'express';
import { ClerkService } from './clerk.service';

@ApiTags('webhooks')
@Controller('webhooks')
export class ClerkController {
  constructor(private readonly clerkService: ClerkService) {}

  @Post('clerk')
  @ApiOperation({
    summary: 'Receive Clerk webhook events',
    description:
      'Public webhook endpoint authenticated using the Clerk Svix signature headers.',
    security: [],
  })
  @ApiHeader({ name: 'svix-id', required: true })
  @ApiHeader({ name: 'svix-timestamp', required: true })
  @ApiHeader({ name: 'svix-signature', required: true })
  @ApiBody({
    schema: {
      type: 'object',
      additionalProperties: true,
      example: { type: 'user.created', data: { id: 'user_2abc123' } },
    },
  })
  @ApiOkResponse({ description: 'Webhook processed successfully' })
  async handleClerkWebhook(
    @Headers('svix-id') svixId: string,
    @Headers('svix-timestamp') svixTimestamp: string,
    @Headers('svix-signature') svixSignature: string,
    @Req() req: RawBodyRequest<Request>,
    @Res() res: Response,
  ) {
    const headers = {
      'svix-id': svixId,
      'svix-timestamp': svixTimestamp,
      'svix-signature': svixSignature,
    };

    try {
      if (!req.rawBody) {
        throw new BadRequestException('Raw webhook body is unavailable.');
      }

      await this.clerkService.handleWebhook(headers, req.rawBody);
      // Respond with 200 OK to acknowledge receipt of the webhook
      res.status(HttpStatus.OK).send('Webhook processed successfully.');
    } catch (err) {
      console.error('Error processing Clerk webhook:', err.message);
      // Respond with an error status if something goes wrong
      res.status(HttpStatus.BAD_REQUEST).send(err.message);
    }
  }
}
