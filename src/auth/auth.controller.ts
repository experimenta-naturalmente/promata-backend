import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { UserType } from 'generated/prisma';
import { User } from 'src/user/user.decorator';
import { DOCUMENT_UPLOAD } from 'src/common/upload.options';
import {
  ChangePasswordDto,
  CreateRootUserDto,
  CreateUserFormDto,
  type CurrentUser,
  ForgotPasswordDto,
  LoginDto,
} from './auth.model';
import { AuthService } from './auth.service';
import { Roles } from './role/roles.decorator';
import { Public } from './role/public.decorator';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('signUp')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @UseInterceptors(FileInterceptor('teacherDocument', DOCUMENT_UPLOAD))
  @ApiConsumes('multipart/form-data')
  @HttpCode(HttpStatus.CREATED)
  async createUser(
    @UploadedFile() file: Express.Multer.File | null,
    @Body() body: CreateUserFormDto,
  ) {
    return await this.authService.createUser(file, body);
  }

  @Public()
  @Post('signIn')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  async signIn(@Body() body: LoginDto) {
    return this.authService.signIn(body);
  }

  @Public()
  @Get('forgot/:token')
  @HttpCode(HttpStatus.OK)
  async checkToken(@Param('token') token: string) {
    return await this.authService.checkToken(token);
  }

  @Public()
  @Post('forgot')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @HttpCode(HttpStatus.NO_CONTENT)
  async forgotPassword(@Body() forgotPasswordDto: ForgotPasswordDto) {
    await this.authService.forgotPassword(forgotPasswordDto);
    return { message: 'Email de recuperação enviado com sucesso.' };
  }

  @Public()
  @Patch('forgot')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @HttpCode(HttpStatus.OK)
  async changePassword(@Body() changePasswordDto: ChangePasswordDto) {
    return await this.authService.changePassword(changePasswordDto);
  }

  @Get('profile')
  @Roles(UserType.GUEST, UserType.ADMIN)
  @ApiBearerAuth('access-token')
  @Throttle({ default: { limit: 300, ttl: 60_000 } })
  @HttpCode(HttpStatus.OK)
  async findProfile(@User() user: CurrentUser) {
    return await this.authService.findProfile(user.id);
  }

  @Post('create-root-user')
  @ApiBearerAuth('access-token')
  @Roles(UserType.ADMIN)
  @HttpCode(HttpStatus.CREATED)
  async createUserAsAdmin(@User() user: CurrentUser, @Body() body: CreateRootUserDto) {
    return await this.authService.createRootUser(user.id, body);
  }
}
