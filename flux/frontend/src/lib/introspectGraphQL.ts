import { SendRequest } from "../../wailsjs/go/main/App";
import type { GraphQLSchema, GraphQLSchemaType, GraphQLSchemaField } from "../types/request";

const INTROSPECTION_QUERY = `{ __schema { types { name kind description fields(includeDeprecated: false) { name description type { name kind ofType { name kind ofType { name kind } } } } } } }`;

function parseSchema(json: any): GraphQLSchema {
  const types: GraphQLSchemaType[] = [];

  for (const t of json.__schema.types ?? []) {
    if (t.name.startsWith("__")) continue;

    const fields: GraphQLSchemaField[] = [];
    for (const f of t.fields ?? []) {
      fields.push({
        name: f.name,
        description: f.description,
        type: f.type ? { name: f.type.name ?? "", kind: f.type.kind, ofType: f.type.ofType } : null,
      });
    }

    types.push({
      name: t.name,
      kind: t.kind,
      description: t.description,
      fields: fields.length > 0 ? fields : undefined,
    });
  }

  return { types };
}

export async function fetchGraphQLSchema(
  url: string,
  headers: { key: string; value: string; enabled: boolean }[],
  authType: string,
  authValue: string,
): Promise<GraphQLSchema> {
  const result = await SendRequest({
    method: "POST",
    url,
    headers,
    params: [],
    bodyType: "graphql",
    body: "",
    bodyForm: [],
    authType,
    authValue,
    graphqlQuery: INTROSPECTION_QUERY,
    graphqlVariables: "{}",
    specPath: "",
  } as never);

  if (result.error) {
    throw new Error(result.error);
  }

  let json: any;
  try {
    json = JSON.parse(result.body);
  } catch {
    throw new Error("Failed to parse introspection response — invalid JSON");
  }

  if (json.errors) {
    const msgs = json.errors.map((e: any) => e.message).join("; ");
    throw new Error(`GraphQL errors: ${msgs}`);
  }

  if (!json.data) {
    throw new Error("No data returned from introspection query");
  }

  return parseSchema(json.data);
}
