import MultiMap from 'multimap';
import reduce, { MonoidalReducer } from 'shift-reducer';

import { Declaration, DeclarationType } from './declaration.js';
import { Accessibility, Reference } from './reference.js';
import Variable from './variable.js';
import { Scope as OrigScope, ScopeType } from './scope.js';

function assignment(node, compound, binding, init) {
  return {
    type: 'assignment',
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
    if (node.init != null) {
      return parameterExpressions(s);
    }
    return s;
  }

  // TODO this should probably have existed in the original
  reduceBindingPropertyProperty(node, { name, binding }) {
    const s = super.reduceBindingPropertyProperty(node, { name, binding });
    if (node.name.type === 'ComputedPropertyName') {
      return parameterExpressions(s);
    }
    return s;
  }

  reduceBindingWithDefault(node, { binding, init }) {
    return parameterExpressions(super.reduceBindingWithDefault(node, { binding, init }));
  }

  reduceBlock(node, { statements }) {
    let decls = [];
    statements.forEach(s => getBlockDecls(s, false, decls));
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
    let decls = [];
    getBlockDecls(init, false, decls);
    return {
      type: 'for',
      node,
      init,
      test,
      update,
      body,
      decls,
    };
  }

  // TODO revist having this
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
    statements.forEach(s => getBlockDecls(s, true, decls));

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
    return this.append(name, {
      type: 'getter',
      node,
      body,
    });
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
      node,
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
    return this.append(name, {
      type: 'method',
      node,
      params,
      body,
    });
  }

  reduceModule(node, { directives, items }) {
    let decls = [];
    items.forEach(s => getBlockDecls(s, true, decls));
    return {
      type: 'module',
      node,
      items,
      decls,
    };
  }

  reduceScript(node, { directives, statements }) {
    let decls = [];
    statements.forEach(s => getBlockDecls(s, true, decls));
    return {
      type: 'script',
      node,
      directives,
      statements,
      decls,
    };
  }

  // TODO getter/setter tests, with computed property names
  reduceSetter(node, { name, param, body }) {
    return this.append(name, {
      type: 'setter',
      node,
      param,
      body,
    });
  }

  reduceSwitchStatement(node, { discriminant, cases }) {
    let decls = [];
    cases.forEach(s => getBlockDecls(s, false, decls));
    return {
      type: 'switch',
      node,
      discriminant,
      cases,
      decls,
    };
  }

  reduceSwitchStatementWithDefault(node, { discriminant, preDefaultCases, defaultCase, postDefaultCases }) {
    // todo maybe just spread like a normal person
    const cases = preDefaultCases.concat([defaultCase], postDefaultCases);
    let decls = [];
    cases.forEach(s => getBlockDecls(s, false, decls));
    return {
      type: 'switch',
      node,
      discriminant,
      cases,
      decls,
    };
  }

  reduceUnaryExpression(node, { operand }) {
    if (node.operator === 'delete' && node.operand.type === 'IdentifierExpression') {
      // 'delete x' is a special case.
      return {
        type: 'delete',
        node,
        operand,
      };
    }
    return super.reduceUnaryExpression(node, { operand });
  }

  reduceUpdateExpression(node, { operand }) {
    return {
      type: 'update',
      node,
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

function getAssignmentTargetIdentifiers(item, out) {
  switch (item.type) {
    case 'ati': {
      out.push(item.node);
      break;
    }
    case 'union': {
      item.values.forEach(v => {
        getAssignmentTargetIdentifiers(v, out);
      });
      break;
    }
    case 'ie': {
      break;
    }
    default: {
      throw new Error('unimplemented: getAssignmentTargetIdentifiers type ' + item.type);
    }
  }
}

// TODO do this during initial pass probably
// TODO reconsider out parameter
// returns `true` if there are parameter expresisons
function getBindings(item, out) {
  switch (item.type) {
    case 'union': {
      return item.values.some(v => getBindings(v, out));
      break;
    }
    case 'bi': {
      out.push(item.node);
      return false;
      break;
    }
    case 'param exprs': {
      getBindings(item.wrapped, out);
      return true;
      break;
    }
    // TODO enumerate cases somewhere probably
    case 'arrow':
    case 'assignment':
    case 'delete':
    case 'function expression':
    case 'ie': {
      return false;
      break;
    }
    default: {
      throw new Error('unimplemented: getBindings type ' + item.type);
    }
  }
}

function getBlockDecls(item, isTopLevel, out) {
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
      if (item.node.name.name !== '*default*') {
        out.push(new Declaration(item.node.name, DeclarationType.CLASS_DECLARATION));
      }
      break;
    }
    case 'function declaration': {
      if (!isTopLevel) {
        out.push(new Declaration(item.node.name, DeclarationType.FUNCTION_DECLARATION));
      }
      break;
    }
    case 'import': {
      let decls = [];
      getBindings(item.defaultBinding, decls);
      // TODO we don't actually need to bother recurring here
      item.namedImports.forEach(n => getBindings(n, decls));

      decls.forEach(d => {
        out.push(new Declaration(d, DeclarationType.IMPORT));
      });

      break;
    }
    case 'union': {
      item.values.forEach(v => getBlockDecls(v, false, out));
      break;
    }


    // ifs with function declarations are ugly: you basically have to wrap a block around the body
    // TODO do that, in the main visitor
    // case 'if': {
    //   getBlockDecls(item.consequent, out);
    //   getBlockDecls(item.alternate, out);
    //   break;
    // }

    // TODO enumerate cases somewhere probably
    // man, typescript would be nice
    case 'catch':
    case 'switch':
    case 'arrow':
    case 'eval':
    case 'for-in':
    case 'for-of':
    case 'for':
    case 'assignment':
    case 'delete':
    case 'class expression':
    case 'function expression':
    case 'if':
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

function getVarDecls(item, strict, forbiddenB33DeclsStack, isTopLevel, outVar, outB33) {
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
      item.statements.forEach(s => getVarDecls(s, strict, forbiddenB33DeclsStack, false, outVar, outB33));
      forbiddenB33DeclsStack.pop();
      break;
    }
    case 'function declaration': {
      let name = item.node.name.name;
      if (name === '*default*') {
        break;
      }
      if (isTopLevel) {
        outVar.push(new Declaration(item.node.name, DeclarationType.FUNCTION_DECLARATION));
        break;
      }
      if (strict || forbiddenB33DeclsStack.some(ds => ds.some(d => d.node !== item.node.name && d.node.name === name))) {
        break;
      }
      outB33.push(new Declaration(item.node.name, DeclarationType.FUNCTION_VAR_DECLARATION));
      break;
    }
    case 'if': {
      // TODO these need different handling probably
      getVarDecls(item.consequent, strict, forbiddenB33DeclsStack, false, outVar, outB33);
      getVarDecls(item.alternate, strict, forbiddenB33DeclsStack, false, outVar, outB33);
      break;
    }
    case 'union': {
      // TODO I think we can just return here; `union` should basically only be for like `a + b`;
      // j/k it's used for switch cases. TODO ensure `switch (x) { case a: function f(){} function g(){} }` is tested.
      item.values.forEach(v => getVarDecls(v, strict, forbiddenB33DeclsStack, false, outVar, outB33));
      break;
    }
    case 'catch': {
      let complexBinding = item.node.binding.type !== 'BindingIdentifier';
      if (complexBinding) {
        // trivial catch bindings don't block B33 hoisting, but non-trivial ones do
        // see https://tc39.es/ecma262/#sec-variablestatements-in-catch-blocks

        // TODO move up
        let bindings = [];
        getBindings(item.binding, bindings);

        forbiddenB33DeclsStack.push(bindings.map(b => new Declaration(b, DeclarationType.CATCH)));
      }
      getVarDecls(item.body, strict, forbiddenB33DeclsStack, false, outVar, outB33);
      if (complexBinding) {
        forbiddenB33DeclsStack.pop();
      }
      break;
    }
    case 'with': {
      getVarDecls(item.body, strict, forbiddenB33DeclsStack, false, outVar, outB33);
      break;
    }
    case 'for': {
      getVarDecls(item.init, strict, forbiddenB33DeclsStack, false, outVar, outB33);
      getVarDecls(item.body, strict, forbiddenB33DeclsStack, false, outVar, outB33);
      break;
    }
    case 'for-in':
    case 'for-of': {
      getVarDecls(item.left, strict, forbiddenB33DeclsStack, false, outVar, outB33);
      getVarDecls(item.body, strict, forbiddenB33DeclsStack, false, outVar, outB33);
      break;
    }
    case 'switch': {
      item.cases.forEach(c => getVarDecls(c, strict, forbiddenB33DeclsStack, false, outVar, outB33));
      break;
    }
    case 'import':
    case 'arrow':
    case 'eval':
    case 'function expression':
    case 'class expression':
    case 'delete':
    case 'assignment':
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
    o.dynamic = o.isDynamic;
    o.variableMap = new Map;
    return o;
  }
}

function synthesize(summary) {
  let strict = false;

  // map string => [{ scope, variable }]
  let namesInScope = new Map;

  let scopeStack = [];

  function enterScope(type, node) {
    let scope = new Scope({
      type,
      astNode: node,
      children: [],
      variables: [],
      isDynamic: type === ScopeType.WITH, // TODO
      // TODO contemplate `through`
      through: new MultiMap(),
    });
    scopeStack[scopeStack.length - 1].children.push(scope);
    scopeStack.push(scope);
  }

  function exitScope() {
    let scope = scopeStack.pop();
    scope.variables.forEach(v => {
      namesInScope.get(v.name).pop();
    });
  }

  function refer(accessibility, node) {
    let name = node.name;

    let ref = new Reference(node, accessibility);
    if (!namesInScope.has(name) || namesInScope.get(name).length === 0) {

      // make a new global
      let variable = new Variable(name, [], []);
      scopeStack[0].variables.push(variable);
      scopeStack[0].variableMap.set(name, variable);
      namesInScope.set(name, [{ scope: scopeStack[0], variable }]);

      // TODO this is kind of dumb
      // we consider references to global variables to pass through the global scope
      scopeStack[0].through.set(name, ref);
    }

    let stack = namesInScope.get(name);
    let { scope, variable } = stack[stack.length - 1];
    variable.references.push(ref);
    for (let i = scopeStack.length - 1; scopeStack[i] !== scope; --i) {
      scopeStack[i].through.set(name, ref);
    }
  }

  // null = 'arguments'
  function declareOne(decl) {
    let scope = scopeStack[scopeStack.length - 1];
    let name = decl == null ? 'arguments' : decl.node.name;
    if (scope.variableMap.has(name)) {
      if (decl != null) {
        scope.variableMap.get(name).declarations.push(decl);
      }
    } else {
      let variable = new Variable(name, [], decl == null ? [] : [decl]);
      scope.variables.push(variable);
      scope.variableMap.set(name, variable);
      if (!namesInScope.has(name)) {
        namesInScope.set(name, []);
      }
      namesInScope.get(name).push({ scope, variable });
    }
  }


  function func(node, paramsItem, body) {
    let oldStrict = strict;
    strict = strict || (node.body.type === 'FunctionBody' && isStrict(node.body));

    let arrow = node.type === 'ArrowExpression';

    let bindings = [];
    let paramExprs = paramsItem.items.map(i => getBindings(i, bindings))
    let hasParameterExpressions = paramExprs.some(b => b);
    let restHasParamExprs = false;
    if (paramsItem.rest != null) {
      restHasParamExprs = getBindings(paramsItem.rest, bindings);
      hasParameterExpressions = hasParameterExpressions || restHasParamExprs;
    }

    let params = bindings.map(b => new Declaration(b, DeclarationType.PARAMETER));

    let paramScope = hasParameterExpressions ? enterScope(ScopeType.PARAMETERS, node) : null;

    if (hasParameterExpressions) {
      if (!arrow) {
        declareOne(null);
      }
      params.forEach(declareOne);
      for (let i = 0; i < node.params.items.length; ++i) {
        if (paramExprs[i]) {
          // each parameter with expressions gets its own scope
          // fortunately they have no declarations
          enterScope(ScopeType.PARAMETER_EXPRESSION, node.params.items[i]);
          visit(paramsItem.items[i]);
          exitScope();
        } else {
          visit(paramsItem.items[i]);
        }
      }
      if (node.params.rest != null) {
        if (restHasParamExprs) {
          enterScope(ScopeType.PARAMETER_EXPRESSION, node.params.rest);
          visit(paramsItem.rest);
          exitScope();
        } else {
          visit(paramsItem.rest);
        }
      }
    }

    let functionScope = enterScope(arrow ? ScopeType.ARROW_FUNCTION : ScopeType.FUNCTION, node);

    if (arrow && node.body.type !== 'FunctionBody') {
      if (!hasParameterExpressions) {
        params.forEach(declareOne);
      }
    } else {
      if (!hasParameterExpressions) {
        declareOne(null);
        params.forEach(declareOne);
      }

      let vs = [];
      // TODO b33vs probably doesn't need to be its own array
      let b33vs = [];

      body.statements.forEach(s => getVarDecls(s, strict, [params, body.decls], true, vs, b33vs));

      body.decls.forEach(declareOne);
      vs.forEach(declareOne);
      b33vs.forEach(declareOne);
    }

    visit(body);


    exitScope();

    if (hasParameterExpressions) {
      exitScope();
    }
    strict = oldStrict;
  }

  function visit(item) {
    if (item == null) {
      return;
    }
    switch (item.type) {
      case 'script': {
        strict = isStrict(item.node);

        // TODO b33vs probably doesn't need to be its own array

        // top-level lexical declarations in scripts are not globals, so first create the global scope for the var-scoped things
        {
          let scope = new Scope({
            type: ScopeType.GLOBAL,
            astNode: item.node,
            children: [],
            variables: [],
            isDynamic: true, // the global scope is always dynamic
            // TODO contemplate `through`
            through: new MultiMap(),
          });
          scopeStack.push(scope);

          let vs = [];
          let b33vs = [];
          item.statements.forEach(s => getVarDecls(s, strict, [item.decls], true, vs, b33vs));        

          vs.concat(b33vs).forEach(declareOne);
        }

        {
          enterScope(ScopeType.SCRIPT, item.node);

          item.decls.forEach(declareOne);
        }

        item.statements.forEach(visit);

        // no particular reason to bother popping stacks
        break;
      }
      case 'module': {
        strict = true;

        // no declarations in a module are global, but there is still a global scope
        let globalScope = new Scope({
          type: ScopeType.GLOBAL,
          astNode: item.node,
          children: [],
          variables: [],
          isDynamic: true, // the global scope is always dynamic
          // TODO contemplate `through`
          through: new MultiMap(),
        });
        scopeStack.push(globalScope);

        enterScope(ScopeType.MODULE, item.node);

        let vs = [];
        item.items.forEach(s => getVarDecls(s, strict, [item.decls], true, vs, []));

        // TODO clean this up
        let decls = [...item.decls, ...vs];
        decls.forEach(declareOne);

        item.items.forEach(visit);

        // no particular reason to bother popping stacks
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
        enterScope(ScopeType.BLOCK, item.node);

        item.decls.forEach(declareOne);

        item.statements.forEach(visit);

        exitScope();
        break;
      }
      case 'class expression':
      case 'class declaration': {
        let oldStrict = strict;
        strict = true;

        enterScope(ScopeType.CLASS_NAME, item.node);

        let hasName =
          item.type == 'class expression'
            ? item.node.name != null
            : item.node.name.name !== '*default*';

        if (hasName) {
          declareOne(new Declaration(item.node.name, DeclarationType.CLASS_NAME));
        }

        visit(item.super);
        item.elements.forEach(visit);

        exitScope();

        strict = oldStrict;
        break;
      }
      case 'function declaration': {
        func(item.node, item.params, item.body);
        break;
      }
      case 'function expression': {
        if (item.node.name != null) {
          enterScope(ScopeType.FUNCTION_NAME, item.node);

          declareOne(new Declaration(item.node.name, DeclarationType.FUNCTION_NAME));

          func(item.node, item.params, item.body);

          exitScope();
        } else {
          func(item.node, item.params, item.body);
        }
        break;
      }
      case 'arrow': {
        func(item.node, item.params, item.body, false);
        break;
      }
      // TODO methods, getters, setters don't need their own type I guess
      case 'method': {
        func(item.node, item.params, item.body, true);
        break;
      }
      case 'with': {
        visit(item.object);
        enterScope(ScopeType.WITH, item.node);

        visit(item.body);

        exitScope();
        break;        
      }
      case 'catch': {
        enterScope(ScopeType.CATCH, item.node);

        // TODO move up
        let bindings = [];
        getBindings(item.binding, bindings);

        // todo not map + foreach
        bindings.map(b => new Declaration(b, DeclarationType.CATCH_PARAMETER)).forEach(declareOne);

        visit(item.binding);
        visit(item.body);

        exitScope();
        break;
      }
      case 'for': {
        enterScope(ScopeType.BLOCK, item.node);

        item.decls.forEach(declareOne);

        visit(item.init);
        visit(item.test);
        visit(item.update);
        visit(item.body);

        exitScope();

        break;
      }
      case 'switch': {
        visit(item.discriminant);

        enterScope(ScopeType.BLOCK, item.node);
        item.decls.forEach(declareOne);

        item.cases.forEach(visit);

        exitScope();

        break;
      }
      case 'if': {
        visit(item.test);
        // These "blocks" are synthetic; see https://tc39.es/ecma262/#sec-functiondeclarations-in-ifstatement-statement-clauses
        if (item.node.consequent.type === 'FunctionDeclaration') {
          enterScope(ScopeType.BLOCK, item.node.consequent);
          declareOne(new Declaration(item.node.consequent.name, DeclarationType.FUNCTION_DECLARATION));

          visit(item.consequent);

          exitScope();
        } else {
          visit(item.consequent);
        }
        if (item.alternate != null) {
          if (item.node.alternate.type === 'FunctionDeclaration') {
            enterScope(ScopeType.BLOCK, item.node.alternate);
            declareOne(new Declaration(item.node.alternate.name, DeclarationType.FUNCTION_DECLARATION));

            visit(item.alternate);

            exitScope();
          } else {
            visit(item.alternate);
          }
        }
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
      case 'assignment': {
        let bindings = [];

        if (item.node.binding.type === 'AssignmentTargetIdentifier') {
          let accessibility = item.compound ? Accessibility.READWRITE : Accessibility.WRITE;
          refer(accessibility, item.node.binding);
        } else {
          getAssignmentTargetIdentifiers(item.binding, bindings);
          bindings.forEach(b => {
            refer(Accessibility.WRITE, b);
          });
        }

        visit(item.binding);
        visit(item.init);

        break;
      }
      case 'update': {
        if (item.node.operand.type === 'AssignmentTargetIdentifier') {
          refer(Accessibility.READWRITE, item.node.operand);
        } else {
          visit(item.node.operand);
        }
        break;
      }
      case 'ie': {
        // TODO figure out how to avoid duplicating write references for ++/+=
        refer(Accessibility.READ, item.node);
        break;
      }
      case 'delete': {
        refer(Accessibility.DELETE, item.node.operand);
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
      case 'eval': {
        // TODO this is useless / actively harmful
        scopeStack[scopeStack.length - 1].dynamic = true;
        visit(item.wrapped);
        break;
      }
      case 'import':
      case 'ati':
      case 'bi': {
        break;
      }
      default: {
        throw new Error('unimplemented: visit type ' + item.type);
      }
    }
  }

  visit(summary);

  // ugh
  function visitScope(scope) {
    let variables = scope.variables;
    scope.variables = scope.variableMap;

    scope.variableList = [];
    for (let x of variables) {
      scope.variableList.push(x);
    }

    scope.lookupVariable = name => scope.variables.get(name);

    for (let child of scope.children) {
      visitScope(child);
    }
  }
  visitScope(scopeStack[0]);

  return scopeStack[0];
}
