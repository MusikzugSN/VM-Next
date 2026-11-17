import { Global, Module } from '@nestjs/common';
import { AppConfig } from '../config/app-config.service';
import { FILE_STORAGE } from './file-storage';
import { FsFileStorage } from './fs-file-storage';

@Global()
@Module({
  providers: [
    {
      provide: FILE_STORAGE,
      inject: [AppConfig],
      useFactory: async (config: AppConfig) => {
        const storage = new FsFileStorage(config.get('FILE_STORAGE_PATH'));
        await storage.init();
        return storage;
      },
    },
  ],
  exports: [FILE_STORAGE],
})
export class StorageModule {}
