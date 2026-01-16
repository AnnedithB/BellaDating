// Upload route placeholder to resolve dependencies
export interface UploadRouteInterface {
  disabled: true;
}

export class UploadRoute implements UploadRouteInterface {
  disabled = true as const;
  
  uploadFile() {
    throw new Error("Upload route disabled - missing dependencies");
  }
  
  getRouter() {
    throw new Error("Upload route disabled - missing dependencies");
  }
}

export const uploadRoute = new UploadRoute();

export default uploadRoute;
