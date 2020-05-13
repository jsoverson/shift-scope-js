import MultiMap from 'multimap';
import reduce, { MonoidalReducer } from 'shift-reducer';

import { Declaration, DeclarationType } from './declaration.js';
import { Accessibility, Reference } from './reference.js';
import Variable from './variable.js';
import { Scope as OrigScope, ScopeType } from './scope.js';

function assignment(node, compound, binding, init) {
  return {
    type: 'reference',
    node,
    compound,
    binding,
    init,
  };
}

function assignmentTargetIdentifier(node) {
  return {
    type: 'ati',
    node,
  };
}

function bindingIdentifier(node) {
  return {
    type: 'bi',
    node,
  };
}

function parameterExpressions(wrapped) {
  return {
    type: 'param exprs',
    wrapped,
  };
}

export default class ScopeAnalyzer extends MonoidalReducer {
  constructor() {
    super({
      empty() {
        return null;
      },
      concat(a, b) {
        throw new RuntimeException('unreachable');
      },
    });

    this.append = (...args) => {
      let real = args.filter(a => a != null);
      if (real.length === 0) {
        return null;
      }
      if (real.length === 1) {
        return real[0];
      }
      return {
        type: 'union',
        values: real,
      };
    };
  }

  static analyze(program) {
    return synthesize(reduce(new ScopeAnalyzer, program));
  }


  reduceArrowExpression(node, { params, body }) {
    return {
      type: 'arrow',
      node,
      params,
      body,
    };
  }

  reduceAssignmentExpression(node, { binding, expression }) {
    return assignment(node, false, binding, expression);
  }

  reduceAssignmentTargetIdentifier(node) {
    return assignmentTargetIdentifier(node);
  }

  reduceBindingIdentifier(node) {
    return bindingIdentifier(node);
  }

  reduceBindingPropertyIdentifier(node, { binding, init }) {
    const s = super.reduceBindingPropertyIdentifier(node, { binding, init });
    if (init) {
      return parameterExpressions(s);
    }
    return s;
  }

  reduceBindingWithDefault(node, { binding, init }) {
    return parameterExpressions(super.reduceBindingWithDefault(node, { binding, init }));
  }

  reduceBlock(node, { statements }) {
    let decls = [];
    statements.forEach(s => getBlockDecls(s, decls));
    return {
      type: 'block',
      node,
      statements,
      decls,
    };
  }

  reduceCallExpression(node, { callee, arguments: _arguments }) {
    const s = super.reduceCallExpression(node, { callee, arguments: _arguments });
    if (node.callee.type === 'IdentifierExpression' && node.callee.name === 'eval') {
      return {
        type: 'eval',
        wrapped: s,
      }
    }
    return s;
  }

  reduceCatchClause(node, { binding, body }) {
    return {
      type: 'catch',
      node,
      binding,
      body,
    };
  }

  reduceClassDeclaration(node, { name, super: _super, elements }) {
    return {
      type: 'class declaration',
      node,
      name,
      super: _super,
      elements,
    };
  }

  reduceClassExpression(node, { name, super: _super, elements }) {
    return {
      type: 'class expression',
      node,
      name,
      super: _super,
      elements,
    };
  }

  reduceCompoundAssignmentExpression(node, { binding, expression }) {
    return assignment(node, true, binding, expression);
  }

  reduceComputedMemberExpression(node, { object, expression }) {
    return parameterExpressions(
      super.reduceComputedMemberExpression(node, { object, expression })
    );
  }

  reduceForInStatement(node, { left, right, body }) {
    return {
      type: 'for-in',
      node,
      left,
      right,
      body,
    };
  }

  reduceForOfStatement(node, { left, right, body }) {
    return {
      type: 'for-of',
      node,
      left,
      right,
      body,
    };
  }

  reduceForStatement(node, { init, test, update, body }) {
    return {
      type: 'for',
      node,
      init,
      test,
      update,
      body,
    };
  }

  reduceFormalParameters(node, { items, rest }) {
    return {
      type: 'parameters',
      node,
      items,
      rest,
    };
  }

  reduceFunctionBody(node, { directives, statements }) {
    let decls = [];
    statements.forEach(s => getBlockDecls(s, decls));

    return {
      type: 'function body',
      node,
      statements,
      decls,
    };
  }

  reduceFunctionDeclaration(node, { name, params, body }) {
    return {
      type: 'function declaration',
      node,
      name,
      params,
      body,
    };
  }

  reduceFunctionExpression(node, { name, params, body }) {
    return {
      type: 'function expression',
      node,
      name,
      params,
      body,
    };
  }

  reduceGetter(node, { name, body }) {
    return {
      type: 'getter',
      node,
      name,
      body,
    };
  }

  reduceIdentifierExpression(node) {
    return {
      type: 'ie',
      node,
    };
  }

  // we need 'if' so we can check if its consequent/alternate are function declarations for b.3.3
  reduceIfStatement(node, { test, consequent, alternate }) {
    return {
      type: 'if',
      test,
      consequent,
      alternate,
    };
  }

  reduceImport(node, { moduleSpecifier, defaultBinding, namedImports }) {
    return {
      type: 'import',
      node,
      defaultBinding,
      namedImports,
    };
  }

  reduceMethod(node, { name, params, body }) {
    return {
      type: 'method',
      node,
      params,
      body,
    };
  }

  reduceModule(node, { directives, items }) {
    return {
      type: 'module',
      node,
      items,
    };
  }

  reduceScript(node, { directives, statements }) {
    let decls = [];
    statements.forEach(s => getBlockDecls(s, decls));
    return {
      type: 'script',
      node,
      directives,
      statements,
      decls,
    };
  }

  reduceSetter(node, { name, param, body }) {
    return {
      type: 'setter',
      node,
      name,
      param,
      body,
    };
  }

  reduceSwitchStatement(node, { discriminant, cases }) {
    return {
      type: 'switch',
      node,
      discriminant,
      cases,
    };
  }

  reduceSwitchStatementWithDefault(node, { discriminant, preDefaultCases, defaultCase, postDefaultCases }) {
    // todo maybe just spread like a normal person
    const cases = preDefaultCases.concat([defaultCase], postDefaultCases);
    return {
      type: 'switch',
      node,
      discriminant,
      cases,
    };
  }

  reduceUnaryExpression(node, { operand }) {
    if (node.operator === 'delete' && node.operand.type === 'IdentifierExpression') {
      // 'delete x' is a special case.
      return {
        type: 'delete',
        operand,
      };
    }
    return super.reduceUnaryExpression(node, { operand });
  }

  reduceUpdateExpression(node, { operand }) {
    return {
      type: 'update',
      operand,
    };
  }

  reduceVariableDeclaration(node, { declarators }) {
    return {
      type: 'variable declaration',
      node,
      declarators,
    };
  }

  reduceVariableDeclarator(node, { binding, init }) {
    // TODO maybe more logic here, for omitted init?
    return {
      type: 'variable declarator',
      node,
      binding,
      init,
    };
  }

  reduceWithStatement(node, { object, body }) {
    return {
      type: 'with',
      node,
      object,
      body,
    };
  }
}

function isStrict(node) {
  return node.directives.some(d => d.rawValue === 'use strict');
}

// TODO reconsider out parameter
function getBindings(item, out) {
  switch (item.type) {
    case 'union': {
      item.values.forEach(v => getBindings(v, out));
      break;
    }
    case 'bi': {
      out.push(item.node);
      break;
    }
    case 'param exprs': {
      getBindings(item.wrapped, out);
      break;
    }
    // TODO enumerate cases somewhere probably
    case 'function expression':
    case 'ie': {
      break;
    }
    default: {
      throw new Error('unimplemented: getBindings type ' + item.type);
    }
  }
}

function getBlockDecls(item, out) {
  if (item == null) {
    return;
  }
  switch (item.type) {
    case 'variable declaration': {
      if (item.node.kind === 'const' || item.node.kind === 'let') {
        item.declarators.forEach(d => {
          let decls = [];
          getBindings(d.binding, decls);

          decls.forEach(d => {
            out.push(new Declaration(d, DeclarationType.fromVarDeclKind(item.node.kind)));
          });
        });
      }
      break;
    }
    case 'class declaration': {
      out.push(new Declaration(item.node.name, DeclarationType.CLASS_DECLARATION));
      break;
    }
    case 'function declaration': {
      out.push(new Declaration(item.node.name, DeclarationType.FUNCTION_DECLARATION));
      break;
    }
    case 'if': {
      getBlockDecls(item.consequent, out);
      getBlockDecls(item.alternate, out);
      break;
    }

    // TODO enumerate cases somewhere probably
    // man, typescript would be nice
    case 'union':
    case 'ie':
    case 'with':
    case 'block': {
      break;
    }
    default: {
      throw new Error('unimplemented: getBlockDecls type ' + item.type);
    }
  }
}

function getVarDecls(item, strict, forbiddenB33DeclsStack, outVar, outB33) {
  if (item == null) {
    return;
  }
  switch (item.type) {
    case 'variable declaration': {
      if (item.node.kind === 'var') {
        item.declarators.forEach(d => {
          let decls = [];
          getBindings(d.binding, decls);

          decls.forEach(d => {
            outVar.push(new Declaration(d, DeclarationType.VAR));
          });
        });
      }
      break;
    }
    case 'block': {
      forbiddenB33DeclsStack.push(item.decls);
      item.statements.forEach(s => getVarDecls(s, strict, forbiddenB33DeclsStack, outVar, outB33));
      forbiddenB33DeclsStack.pop();
      break;
    }
    case 'function declaration': {
      let name = item.node.name.name;
      if (strict || forbiddenB33DeclsStack.some(ds => ds.some(d => d.node !== item.node.name && d.node.name === name))) {
        return;
      }
      outB33.push(new Declaration(item.node.name, DeclarationType.FUNCTION_VAR_DECLARATION));
      break;
    }
    case 'if': {
      getVarDecls(item.consequent, strict, forbiddenB33DeclsStack, outVar, outB33);
      getVarDecls(item.alternate, strict, forbiddenB33DeclsStack, outVar, outB33);
      break;
    }
    case 'union': {
      item.values.forEach(v => getVarDecls(v, strict, forbiddenB33DeclsStack, outVar, outB33));
      break;
    }
    case 'ie':
    case 'class declaration': {
      break;
    }
    default: {
      throw new Error('unimplemented: getVarDecls type ' + item.type);
    }
  }
}

// TODO
class Scope {
  constructor(o) {
    return o;
  }
}

function synthesize(analysis) {
  let strict = false;



  // map string => [{ scope, variable }]
  let namesInScope = new Map;

  let scopeStack = [];

  function enterScope(type, node) {
    let variables = [];

    let scope = new Scope({
      type,
      astNode: null,//node,
      children: [],
      variables,
      isDynamic: false, // TODO
      // TODO contemplate `through`
      through: new MultiMap(),
    });
    scopeStack[scopeStack.length - 1].children.push(scope);
    scopeStack.push(scope);
    return scope;
  }

  function exitScope() {
    scopeStack.pop();
  }

  function refer(accessibility, node) {
    let name = node.name;

    if (!namesInScope.has(name)) {
      // make a new global
      let variable = new Variable(name, [], []);
      scopeStack[0].variables.push(variable);
      namesInScope.set(name, [{ scope: scopeStack[0], variable }]);
    }

    let stack = namesInScope.get(name);
    let { scope, variable } = stack[stack.length - 1];
    let ref = new Reference(node, accessibility);
    variable.references.push(ref);
    for (let i = scopeStack.length - 1; scopeStack[i] !== scope; --i) {
      scopeStack[i].through.set(name, ref);
    }
  }

  // TODO declare can just manipulate the top of the scope stack
  function declare(scope, decls) {
    // string => variable
    let declaredInThisScope = new Map;
    decls.forEach(d => {
      // console.log(d);
      let name = d.node.name;
      if (declaredInThisScope.has(name)) {
        declaredInThisScope.get(name).declarations.push(d);
      } else {
        let variable = new Variable(name, [], [d]);
        declaredInThisScope.set(name, variable);
        scope.variables.push(variable);
        if (!namesInScope.has(name)) {
          namesInScope.set(name, []);
        }
        namesInScope.get(name).push({ scope, variable });
      }
    });
    // todo maybe just return keys
    return declaredInThisScope;
  }

  function visit(item) {
    if (item == null) {
      return;
    }
    switch (item.type) {
      case 'script': {
        let oldStrict = strict;
        strict = strict && isStrict(item.node);

        // console.log(item.decls);

        let vs = [];
        let b33vs = [];
        item.statements.forEach(s => getVarDecls(s, strict, [item.decls], vs, b33vs));        

        // TODO b33vs probably doesn't need to be its own array
        // TODO figure out a better way of preventing top-level functions from being B33'd
        b33vs = b33vs.filter(n => !item.node.statements.some(s => s.type === 'FunctionDeclaration' && s.name === n));

        // console.log(vs);
        // console.log(b33vs);

        // top-level lexical declarations in scripts are not globals, so first create the global scope for the var-scoped things
        {
          let variables = [];

          let scope = new Scope({
            type: ScopeType.GLOBAL,
            astNode: null,//item.node,
            children: [],
            variables,
            isDynamic: false, // TODO
            // TODO contemplate `through`
            through: new MultiMap(),
          });
          scopeStack.push(scope);

          vs.concat(b33vs).forEach(d => {
            let name = d.node.name;
            if (namesInScope.has(name)) {
              namesInScope.get(name)[0].variable.declarations.push(d);
            } else {
              let variable = new Variable(name, [], [d]);
              variables.push(variable);
              namesInScope.set(name, [{ scope, variable }]);
            }
          });
        }

        {
          let scope = enterScope(ScopeType.SCRIPT, null);

          declare(scope, item.decls);
        }

        item.statements.forEach(visit);

        // no particular reason to bother popping stacks

        strict = oldStrict;
        break;
      }
      case 'variable declaration': {
        item.declarators.forEach(visit);
        break;
      }
      case 'variable declarator': {
        if (item.node.init != null) {
          // TODO do the getBindings during the inital tree walk
          let bindings = [];
          getBindings(item.binding, bindings);
          bindings.forEach(b => {
            refer(Accessibility.WRITE, b);
          });
        }

        visit(item.binding);
        visit(item.init);

        break;
      }
      case 'block': {
        let scope = enterScope(ScopeType.BLOCK, null);

        let declaredInThisScope = declare(scope, item.decls);

        item.statements.forEach(visit);

        for (let name of declaredInThisScope.keys()) {
          namesInScope.get(name).pop();
        }
        exitScope();
        break;
      }
      case 'class declaration': {
        let oldStrict = strict;
        strict = true;

        let scope = enterScope(ScopeType.CLASS_NAME, null);

        declare(scope, [new Declaration(item.node.name, DeclarationType.CLASS_NAME)]);

        // TODO visit children

        namesInScope.get(item.node.name.name).pop();

        exitScope();

        strict = oldStrict;
        break;
      }
      case 'function declaration': {
        let oldStrict = strict;
        strict = strict && isStrict(item.node);

        // TODO I guess this should be conditional on there being parameter expressions?
        let paramScope = enterScope(ScopeType.PARAMETERS, null);

        // TODO `arguments`??? in parameters?

        let bindings = [];
        item.params.items.forEach(i => getBindings(i, bindings));
        if (item.params.rest != null) {
          getBindings(item.params.rest, bindings);
        }
        let params = bindings.map(b => new Declaration(b, DeclarationType.PARAMETER));
        let declaredInParamsScope = declare(paramScope, params);

        visit(item.params);

        // TODO visit children
        let vs = [];
        let b33vs = [];
        // TODO confirm B.3.3 can't conflict with parameters
        item.body.statements.forEach(s => getVarDecls(s, strict, [params, item.body.decls], vs, b33vs));
        // TODO b33vs probably doesn't need to be its own array
        // TODO figure out a better way of preventing top-level functions from being B33'd
        b33vs = b33vs.filter(n => !item.node.body.statements.some(s => s.type === 'FunctionDeclaration' && s.name === n));

        let functionScope = enterScope(ScopeType.FUNCTION, null);

        let declaredInFunctionScope = declare(functionScope, [...item.body.decls, ...vs, ...b33vs]);

        visit(item.body);


        exitScope();
        for (let name of declaredInFunctionScope.keys()) {
          namesInScope.get(name).pop();
        }

        exitScope();
        for (let name of declaredInParamsScope.keys()) {
          namesInScope.get(name).pop();
        }
        strict = oldStrict;
        break;
      }
      case 'parameters': {
        item.items.forEach(visit);
        if (item.rest != null) {
          visit(item.rest);
        }
        break;
      }
      // TODO revisit having function body represented
      case 'function body': {
        item.statements.forEach(visit);
        break;
      }
      case 'if': {
        visit(item.consequent);
        if (item.alternate != null) {
          visit(item.alternate);
        }
        break;
      }
      case 'bi': {
        break;
      }
      case 'ie': {
        // TODO figure out how to avoid duplicating write references for ++/+=
        refer(Accessibility.READ, item.node);
        break;
      }
      case 'param exprs': {
        // TODO
        visit(item.wrapped);
        break;
      }
      case 'union': {
        item.values.forEach(visit);
        break;
      }
      default: {
        throw new Error('unimplemented: visit type ' + item.type);
      }
    }
  }

  visit(analysis);

  return scopeStack[0];
}
