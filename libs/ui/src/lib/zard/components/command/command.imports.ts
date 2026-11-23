import { ZardCommandDividerComponent } from '@vm-web/ui/zard/components/command/command-divider.component';
import { ZardCommandInputComponent } from '@vm-web/ui/zard/components/command/command-input.component';
import { ZardCommandListComponent } from '@vm-web/ui/zard/components/command/command-list.component';
import { ZardCommandOptionGroupComponent } from '@vm-web/ui/zard/components/command/command-option-group.component';
import { ZardCommandOptionComponent } from '@vm-web/ui/zard/components/command/command-option.component';
import { ZardCommandComponent } from '@vm-web/ui/zard/components/command/command.component';

export const ZardCommandImports = [
  ZardCommandComponent,
  ZardCommandInputComponent,
  ZardCommandListComponent,
  ZardCommandOptionComponent,
  ZardCommandOptionGroupComponent,
  ZardCommandDividerComponent,
] as const;
