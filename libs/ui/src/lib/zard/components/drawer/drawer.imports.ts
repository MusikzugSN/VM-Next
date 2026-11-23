import {
  ZardDrawerCloseDirective,
  ZardDrawerComponent,
  ZardDrawerDescriptionComponent,
  ZardDrawerFooterComponent,
  ZardDrawerHeaderComponent,
  ZardDrawerTitleComponent,
} from '@vm-web/ui/zard/components/drawer/drawer.component';

export const ZardDrawerImports = [
  ZardDrawerComponent,
  ZardDrawerHeaderComponent,
  ZardDrawerTitleComponent,
  ZardDrawerDescriptionComponent,
  ZardDrawerFooterComponent,
  ZardDrawerCloseDirective,
] as const;
