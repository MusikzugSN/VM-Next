import { Body, Controller, Get, HttpCode, Inject, Param, Post, Query, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  API_ROUTES,
  applyLineupTemplateResponseSchema,
  configDefaultOptionsResponseSchema,
  configResponseSchema,
  createdResponseSchema,
  createEnsembleBodySchema,
  createRoleBodySchema,
  ensembleDetailsResponseSchema,
  ensembleLineupResponseSchema,
  ensembleListQuerySchema,
  ensembleListResponseSchema,
  ensembleMembersQuerySchema,
  ensembleOptionsResponseSchema,
  ensembleMembersResponseSchema,
  ensembleParamsSchema,
  ensemblePrintRulesResponseSchema,
  setPrintRulesBodySchema,
  type SetPrintRulesBody,
  LOGO_FILE_FIELD,
  permissionCatalogResponseSchema,
  removeMembershipBodySchema,
  renameBodySchema,
  resetDefaultsResponseSchema,
  roleDetailsResponseSchema,
  roleListQuerySchema,
  roleListResponseSchema,
  roleParamsSchema,
  setAdminBodySchema,
  setLineupBodySchema,
  setMembershipBodySchema,
  setParentBodySchema,
  setPermissionsBodySchema,
  setUserVoicesBodySchema,
  updateClubBodySchema,
  updateDefaultsBodySchema,
  updatePrintBodySchema,
  userAssignmentOptionsResponseSchema,
  userDetailsResponseSchema,
  userParamsSchema,
  userTableQuerySchema,
  userTableResponseSchema,
  type CreateEnsembleBody,
  type CreateRoleBody,
  type CursorQuery,
  type EnsembleListQuery,
  type RemoveMembershipBody,
  type RenameBody,
  type SetAdminBody,
  type SetLineupBody,
  type SetMembershipBody,
  type SetParentBody,
  type SetPermissionsBody,
  type SetUserVoicesBody,
  type UpdateClubBody,
  type UpdateDefaultsBody,
  type UpdatePrintBody,
  type UserTableQuery,
} from '@vm-web/shared';
import type { AccessContext } from '../access/access-context';
import { CurrentAccess, RequireAdmin, RequirePermission } from '../access/decorators';
import { ResponseSchema } from '../common/validation/zod-response.interceptor';
import { ZodValidationPipe as Zod } from '../common/validation/zod-validation.pipe';
import { ConfigService } from './config.service';
import { EnsemblesService } from './ensembles.service';
import { RolesService } from './roles.service';
import { UsersService } from './users.service';
import { PrintRulesService } from '../print-rules/print-rules.service';

const R = API_ROUTES.system;
type UserParams = { userId: string };
type EnsembleParams = { ensembleId: string };
type RoleParams = { roleId: string };

/** Users (S-1, A-5, R-1, R-6). System permissions apply club-wide (R-4, F-1). */
@Controller(R.base)
export class SystemUsersController {
  constructor(@Inject(UsersService) private readonly users: UsersService) {}

  @RequirePermission('user.view')
  @Get(R.userTable.path)
  @ResponseSchema(userTableResponseSchema)
  table(@Query(new Zod(userTableQuerySchema)) q: UserTableQuery) {
    return this.users.table(q);
  }

  @RequirePermission('user.edit')
  @Get(R.userAssignmentOptions.path)
  @ResponseSchema(userAssignmentOptionsResponseSchema)
  assignmentOptions(@CurrentAccess() access: AccessContext) {
    return this.users.assignmentOptions(access);
  }

  @RequirePermission('user.view')
  @Get(R.userDetails.path)
  @ResponseSchema(userDetailsResponseSchema)
  details(@Param(new Zod(userParamsSchema)) p: UserParams) {
    return this.users.details(p.userId);
  }

  @RequirePermission('user.edit')
  @Post(R.setMembership.path)
  @HttpCode(204)
  async setMembership(@CurrentAccess() access: AccessContext, @Param(new Zod(userParamsSchema)) p: UserParams, @Body(new Zod(setMembershipBodySchema)) body: SetMembershipBody) {
    await this.users.setMembership(access, p.userId, body.ensembleId, body.roleId);
  }

  @RequirePermission('user.edit')
  @Post(R.removeMembership.path)
  @HttpCode(204)
  async removeMembership(@CurrentAccess() access: AccessContext, @Param(new Zod(userParamsSchema)) p: UserParams, @Body(new Zod(removeMembershipBodySchema)) body: RemoveMembershipBody) {
    await this.users.removeMembership(access, p.userId, body.ensembleId);
  }

  @RequirePermission('user.edit')
  @Post(R.setUserVoices.path)
  @HttpCode(204)
  async setVoices(@Param(new Zod(userParamsSchema)) p: UserParams, @Body(new Zod(setUserVoicesBodySchema)) body: SetUserVoicesBody) {
    await this.users.setVoices(p.userId, body.voiceIds);
  }

  @RequirePermission('user.edit')
  @Post(R.blockUser.path)
  @HttpCode(204)
  async block(@CurrentAccess() access: AccessContext, @Param(new Zod(userParamsSchema)) p: UserParams) {
    await this.users.block(access.userId, p.userId);
  }

  @RequirePermission('user.edit')
  @Post(R.unblockUser.path)
  @HttpCode(204)
  async unblock(@Param(new Zod(userParamsSchema)) p: UserParams) {
    await this.users.unblock(p.userId);
  }

  @RequireAdmin()
  @Post(R.setAdmin.path)
  @HttpCode(204)
  async setAdmin(@Param(new Zod(userParamsSchema)) p: UserParams, @Body(new Zod(setAdminBodySchema)) body: SetAdminBody) {
    await this.users.setAdmin(p.userId, body.isAdmin);
  }

  @RequirePermission('user.delete')
  @Post(R.deleteUser.path)
  @HttpCode(204)
  async delete(@CurrentAccess() access: AccessContext, @Param(new Zod(userParamsSchema)) p: UserParams) {
    await this.users.delete(access.userId, p.userId);
  }
}

/** Ensembles (S-2, F-3, N-4, N-8). Members also with `member.view` in the ensemble (R-3). */
@Controller(R.base)
export class SystemEnsemblesController {
  constructor(
    @Inject(EnsemblesService) private readonly ensembles: EnsemblesService,
    @Inject(PrintRulesService) private readonly printRules: PrintRulesService,
  ) {}

  @RequirePermission('ensemble.view')
  @Get(R.ensembleList.path)
  @ResponseSchema(ensembleListResponseSchema)
  list(@Query(new Zod(ensembleListQuerySchema)) q: EnsembleListQuery) {
    return this.ensembles.list(q);
  }

  @RequirePermission('ensemble.view')
  @Get(R.ensembleOptions.path)
  @ResponseSchema(ensembleOptionsResponseSchema)
  options() {
    return this.ensembles.options();
  }

  @RequirePermission(['ensemble.view', 'member.view'], { ensembleFrom: 'param:ensembleId' })
  @Get(R.ensembleDetails.path)
  @ResponseSchema(ensembleDetailsResponseSchema)
  details(@Param(new Zod(ensembleParamsSchema)) p: EnsembleParams) {
    return this.ensembles.details(p.ensembleId);
  }

  @RequirePermission('ensemble.view')
  @Get(R.ensembleLineup.path)
  @ResponseSchema(ensembleLineupResponseSchema)
  lineup(@Param(new Zod(ensembleParamsSchema)) p: EnsembleParams) {
    return this.ensembles.lineup(p.ensembleId);
  }

  @RequirePermission(['ensemble.view', 'member.view'], { ensembleFrom: 'param:ensembleId' })
  @Get(R.ensembleMembers.path)
  @ResponseSchema(ensembleMembersResponseSchema)
  members(@Param(new Zod(ensembleParamsSchema)) p: EnsembleParams, @Query(new Zod(ensembleMembersQuerySchema)) q: { q?: string; cursor?: string; limit: number }) {
    return this.ensembles.members(p.ensembleId, q);
  }

  @RequirePermission('ensemble.create')
  @Post(R.createEnsemble.path)
  @ResponseSchema(createdResponseSchema)
  create(@Body(new Zod(createEnsembleBodySchema)) body: CreateEnsembleBody) {
    return this.ensembles.create(body);
  }

  @RequirePermission('ensemble.edit')
  @Post(R.renameEnsemble.path)
  @HttpCode(204)
  async rename(@Param(new Zod(ensembleParamsSchema)) p: EnsembleParams, @Body(new Zod(renameBodySchema)) body: RenameBody) {
    await this.ensembles.rename(p.ensembleId, body.name);
  }

  @RequirePermission('ensemble.edit')
  @Post(R.moveEnsemble.path)
  @HttpCode(204)
  async setParent(@CurrentAccess() access: AccessContext, @Param(new Zod(ensembleParamsSchema)) p: EnsembleParams, @Body(new Zod(setParentBodySchema)) body: SetParentBody) {
    await this.ensembles.setParent(access, p.ensembleId, body.parentId);
  }

  @RequirePermission('ensemble.edit')
  @Post(R.archiveEnsemble.path)
  @HttpCode(204)
  async archive(@Param(new Zod(ensembleParamsSchema)) p: EnsembleParams) {
    await this.ensembles.archive(p.ensembleId);
  }

  @RequirePermission('ensemble.edit')
  @Post(R.unarchiveEnsemble.path)
  @HttpCode(204)
  async unarchive(@Param(new Zod(ensembleParamsSchema)) p: EnsembleParams) {
    await this.ensembles.unarchive(p.ensembleId);
  }

  /** Print rules in effect, own or inherited (S-2, D-6). */
  @RequirePermission('ensemble.view')
  @Get(R.ensemblePrintRules.path)
  @ResponseSchema(ensemblePrintRulesResponseSchema)
  printRulesOf(@Param(new Zod(ensembleParamsSchema)) p: EnsembleParams) {
    return this.printRules.forEnsemble(p.ensembleId);
  }

  @RequirePermission('ensemble.edit')
  @Post(R.setPrintRules.path)
  @HttpCode(204)
  async setPrintRules(@Param(new Zod(ensembleParamsSchema)) p: EnsembleParams, @Body(new Zod(setPrintRulesBodySchema)) body: SetPrintRulesBody) {
    await this.printRules.set(p.ensembleId, body.rules);
  }

  /** Drops own rules; the ensemble inherits again. */
  @RequirePermission('ensemble.edit')
  @Post(R.resetPrintRules.path)
  @HttpCode(204)
  async resetPrintRules(@Param(new Zod(ensembleParamsSchema)) p: EnsembleParams) {
    await this.printRules.reset(p.ensembleId);
  }

  @RequirePermission('ensemble.edit')
  @Post(R.setLineup.path)
  @HttpCode(204)
  async setLineup(@Param(new Zod(ensembleParamsSchema)) p: EnsembleParams, @Body(new Zod(setLineupBodySchema)) body: SetLineupBody) {
    await this.ensembles.setLineup(p.ensembleId, body.voiceIds);
  }

  @RequirePermission('ensemble.edit')
  @Post(R.applyLineupTemplate.path)
  @HttpCode(200)
  @ResponseSchema(applyLineupTemplateResponseSchema)
  applyLineupTemplate(@Param(new Zod(ensembleParamsSchema)) p: EnsembleParams) {
    return this.ensembles.applyLineupTemplate(p.ensembleId);
  }
}

/** Roles with permission matrix (S-3, R-3, R-5, R-7). */
@Controller(R.base)
export class SystemRolesController {
  constructor(@Inject(RolesService) private readonly roles: RolesService) {}

  @RequirePermission('role.view')
  @Get(R.roleList.path)
  @ResponseSchema(roleListResponseSchema)
  list(@Query(new Zod(roleListQuerySchema)) q: CursorQuery) {
    return this.roles.list(q);
  }

  @RequirePermission('role.view')
  @Get(R.permissionCatalog.path)
  @ResponseSchema(permissionCatalogResponseSchema)
  catalog() {
    return this.roles.catalog();
  }

  @RequirePermission('role.view')
  @Get(R.roleDetails.path)
  @ResponseSchema(roleDetailsResponseSchema)
  details(@Param(new Zod(roleParamsSchema)) p: RoleParams) {
    return this.roles.details(p.roleId);
  }

  @RequirePermission('role.create')
  @Post(R.createRole.path)
  @ResponseSchema(createdResponseSchema)
  create(@Body(new Zod(createRoleBodySchema)) body: CreateRoleBody) {
    return this.roles.create(body.name, body.permissions);
  }

  @RequirePermission('role.edit')
  @Post(R.renameRole.path)
  @HttpCode(204)
  async rename(@Param(new Zod(roleParamsSchema)) p: RoleParams, @Body(new Zod(renameBodySchema)) body: RenameBody) {
    await this.roles.rename(p.roleId, body.name);
  }

  @RequirePermission('role.edit')
  @Post(R.setPermissions.path)
  @HttpCode(204)
  async setPermissions(@Param(new Zod(roleParamsSchema)) p: RoleParams, @Body(new Zod(setPermissionsBodySchema)) body: SetPermissionsBody) {
    await this.roles.setPermissions(p.roleId, body.permissions);
  }

  @RequirePermission('role.delete')
  @Post(R.deleteRole.path)
  @HttpCode(204)
  async delete(@Param(new Zod(roleParamsSchema)) p: RoleParams) {
    await this.roles.delete(p.roleId);
  }

  @RequirePermission('role.edit')
  @Post(R.resetRole.path)
  @HttpCode(204)
  async reset(@Param(new Zod(roleParamsSchema)) p: RoleParams) {
    await this.roles.resetToDefault(p.roleId);
  }

  @RequirePermission('role.edit')
  @Post(R.resetAllRoles.path)
  @HttpCode(200)
  @ResponseSchema(resetDefaultsResponseSchema)
  resetAll() {
    return this.roles.resetDefaults();
  }
}

/** Configuration (S-4, D-2, D-4). Custom fields live under `scores/field-definitions` (F-13). */
@Controller(R.base)
export class SystemConfigController {
  constructor(@Inject(ConfigService) private readonly config: ConfigService) {}

  @RequirePermission('config.view')
  @Get(R.config.path)
  @ResponseSchema(configResponseSchema)
  get() {
    return this.config.get();
  }

  @RequirePermission('config.edit')
  @Get(R.configDefaultOptions.path)
  @ResponseSchema(configDefaultOptionsResponseSchema)
  defaultOptions() {
    return this.config.defaultOptions();
  }

  @RequirePermission('config.edit')
  @Post(R.updateClub.path)
  @HttpCode(204)
  async updateClub(@Body(new Zod(updateClubBodySchema)) body: UpdateClubBody) {
    await this.config.updateClub(body);
  }

  @RequirePermission('config.edit')
  @Post(R.updateDefaults.path)
  @HttpCode(204)
  async updateDefaults(@Body(new Zod(updateDefaultsBodySchema)) body: UpdateDefaultsBody) {
    await this.config.updateDefaults(body);
  }

  @RequirePermission('config.edit')
  @Post(R.updatePrint.path)
  @HttpCode(204)
  async updatePrint(@Body(new Zod(updatePrintBodySchema)) body: UpdatePrintBody) {
    await this.config.updatePrint(body);
  }

  @RequirePermission('config.edit')
  @Post(R.uploadLogo.path)
  @HttpCode(204)
  @UseInterceptors(FileInterceptor(LOGO_FILE_FIELD))
  async uploadLogo(@UploadedFile() file: { path: string } | undefined) {
    await this.config.uploadLogo(file);
  }

  @RequirePermission('config.edit')
  @Post(R.removeLogo.path)
  @HttpCode(204)
  async removeLogo() {
    await this.config.removeLogo();
  }
}
