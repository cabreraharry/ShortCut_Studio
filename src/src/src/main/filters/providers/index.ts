import type { ClassifiedFilename, ClassifyFileInput, ClassifierProvider } from '@shared/types'

export interface ClassifierAdapterOpts {
  filenames: ClassifyFileInput[]
  apiKey: string
  apiHost: string
  model: string
  signal?: AbortSignal
}

export interface ClassifierAdapter {
  readonly provider: ClassifierProvider
  readonly defaultModel: string
  classify(opts: ClassifierAdapterOpts): Promise<ClassifiedFilename[]>
}
