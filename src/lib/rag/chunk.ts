import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters'

const splitter = new RecursiveCharacterTextSplitter({
  chunkSize: 1500,
  chunkOverlap: 200,
})

export async function splitText(text: string): Promise<string[]> {
  const docs = await splitter.createDocuments([text])
  return docs.map(d => d.pageContent).filter(c => c.trim().length > 50)
}
