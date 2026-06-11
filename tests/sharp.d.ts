// Sharp ships type declarations at lib/index.d.ts but the package's "exports"
// map only points to dist/, which moduleResolution: "bundler" cannot pierce.
// Re-export the types from the resolvable path.
declare module "sharp" {
  import sharp from "sharp/lib/index";
  export default sharp;
}
