const Zeact = {
    createElement,
    render,
    useState
}

const TEXT_ELEMENT = 'TEXT_ELEMENT'


function isObject(obj) {
    return typeof obj === 'object'
}

function createElement(type, props, ...children) {
    console.log(type, props, children);
    return {
        type,
        props: {
            ...props,
            children: children.map(item =>
                isObject(item) ? item : createTextElement(item)
            )
        },
    }
}

// 将text转换成element
function createTextElement(text) {
    return {
        type: TEXT_ELEMENT,
        props: {
            nodeValue: text,
            children: []
        }
    }
}

let nextUnitOfWork = null
let wipRoot = null
let currentRoot = null
let deletions = null

function render(elemet, container) {
    // 设置下一个工作单元（nextUnitOfWork）
    // 设置 fiber 树的根（root fiber
    wipRoot = {
        dom: container,
        props: {
            children: [elemet]
        },
        alternate: currentRoot// 指向旧的 fiber
    }
    deletions = []
    nextUnitOfWork = wipRoot
}

const isEvent = (key) => key.startsWith('on')

const isProperty = (key) => key !== 'children'

const isNew = (prev, next) => key => prev[key] !== next[key]

const isGone = (prev, next) => key => !(key in next)

const getEventType = (name) => name.toLowerCase().substring(2)

const isFunctionComponent = (fiber) => fiber.type instanceof Function

function createDom(fiber) {
    const dom =
        fiber.type === TEXT_ELEMENT
            ? document.createTextNode('')
            : document.createElement(fiber.type)

    updateDom(dom, {}, fiber.props)

    return dom
}

function updateDom(dom, prevProps, nextProps) {
    // 删除旧的属性
    Object.keys(prevProps)
        .filter(isProperty)
        .filter(isGone(prevProps, nextProps))
        .forEach(name => {
            dom[name] = ''
        })

    // 删除旧的或者已改变的事件监听器
    Object.keys(prevProps)
        .filter(isEvent)
        .filter(key => isGone(prevProps, nextProps)(key) || isNew(prevProps, nextProps)(key))
        .forEach(name => {
            const eventType = getEventType(name)
            dom.removeEventListener(eventType, prevProps[name])
        })

    // 设置新的属性
    Object.keys(nextProps)
        .filter(isProperty)
        .filter(isNew(prevProps, nextProps))
        .forEach(name => {
            dom[name] = nextProps[name]
        })

    // 添加事件监听器
    Object.keys(nextProps)
        .filter(isEvent)
        .filter(isNew(prevProps, nextProps))
        .forEach(name => {
            const eventType = getEventType(name)
            dom.addEventListener(eventType, nextProps[name])
        })
}

function workLoop(deadLine) {
    let shouldYield = false
    while (nextUnitOfWork && !shouldYield) {
        nextUnitOfWork = performUnitOfWork(nextUnitOfWork)
        shouldYield = deadLine.timeRemaining() < 1
    }

    // 一旦结束所有工作（因为没有下一个工作单元），便将整个 fiber 树提交给 DOM
    if (!nextUnitOfWork && wipRoot) {
        commitRoot()
    }

    requestIdleCallback(workLoop)
}
// 浏览器在主线程空闲时运行回调
requestIdleCallback(workLoop)

function commitRoot() {
    // 先处理需要删除的节点
    deletions.forEach(commitWork)
    // 剩下就只有添加和更新
    // 添加节点到root
    commitWork(wipRoot.child)
    currentRoot = wipRoot
    wipRoot = null
}

function commitWork(fiber) {
    if (!fiber) {
        return
    }
    let domParentFiber = fiber.parent
    while (!domParentFiber.dom) {
        domParentFiber = domParentFiber.parent
    }
    const domParent = domParentFiber.dom
    if (fiber.effectTag === 'PLACEMENT' && fiber.dom != null) {
        domParent.appendChild(fiber.dom)
    } else if (fiber.effectTag === 'UPDATE' && fiber.dom != null) {
        updateDom(fiber.dom, fiber.alternate.props, fiber.props)
    } else if (fiber.effectTag === 'DELETION') {
        commitDeletion(fiber, domParent)
    }
    commitWork(fiber.child)
    commitWork(fiber.sibling)
}

//在删除节点时，找到具体的带有 DOM 节点的子节点
function commitDeletion(fiber, domParent) {
    if (fiber.dom) {
        domParent.removeChild(fiber.dom)
    } else {
        commitDeletion(fiber.child, domParent)
    }
}

/**
 * 对每一个 fiber
 * 1 将 element 添加到 DOM
 * 2 为每个 element 的 children 创建 fiber
 * 3 选择下一个工作单元
 */
function performUnitOfWork(fiber) {
    if (isFunctionComponent(fiber)) {
        updateFunctionComponent(fiber)
    } else {
        updateHostComponent(fiber)
    }

    // 返回 nextUnitOfWork
    // 开始查找下一个工作单元，首先从其子节点开始查找，
    // 然后找其兄弟节点，再找叔叔节点，依此推内。
    // 或者到根节点结束
    if (fiber.child) {
        return fiber.child
    }
    let nextFiber = fiber
    while (nextFiber) {
        if (nextFiber.sibling) {
            return nextFiber.sibling
        }
        nextFiber = nextFiber.parent
    }
}

let wipFiber;
let hookIndex;

// 函数组件
function updateFunctionComponent(fiber) {
    wipFiber = fiber
    hookIndex = 0
    wipFiber.hooks = []
    const children = [fiber.type(fiber.props)]
    // 调和
    reconcileChildren(fiber, children)
}

function useState(initial) {
    const oldHook =
        wipFiber.alternate &&
        wipFiber.alternate.hooks &&
        wipFiber.alternate.hooks[hookIndex]
    const hook = {
        state: oldHook ? oldHook.state : initial,
        queue: []
    }
    const actions = oldHook ? oldHook.queue : []
    actions.forEach(action => {
        hook.state = action(oldHook.state)
    })
    const setState = action => {
        hook.queue.push(action)

        wipRoot = {
            dom: currentRoot.dom,
            props: currentRoot.props,
            alternate: currentRoot
        }
        nextUnitOfWork = wipRoot
        deletions = []
    }
    wipFiber.hooks.push(hook)
    hookIndex++
    return [hook.state, setState]
}

function updateHostComponent(fiber) {
    // 添加 dom 节点
    if (!fiber.dom) {
        fiber.dom = createDom(fiber)
    }
    // 调和
    // 创建新的fiber
    const elements = fiber.props.children
    reconcileChildren(fiber, elements)
}

function reconcileChildren(wipFiber, elements) {
    let index = 0
    let oldFiber = wipFiber.alternate && wipFiber.alternate.child
    let prevSibling = null
    while (index < elements.length || oldFiber != null) {
        const elemet = elements[index]
        let newFiber = null

        const sameType = oldFiber && elemet && elemet.type === oldFiber.type

        if (sameType) {
            // 更新node
            newFiber = {
                type: elemet.type,
                props: elemet.props,
                dom: oldFiber.dom,
                parent: wipFiber,
                alternate: oldFiber,
                effectTag: 'UPDATE',
            }
        }

        if (elemet && !sameType) {
            // 新增node
            newFiber = {
                type: elemet.type,
                props: elemet.props,
                dom: null,
                parent: wipFiber,
                alternate: null,
                effectTag: 'PLACEMENT',
            }
        }

        if (oldFiber && !sameType) {
            // 删除oldFiber的node
            oldFiber.effectTag = 'DELETION'
            deletions.push(oldFiber)
        }

        // 比较旧的fiber和element
        if (oldFiber) {
            oldFiber = oldFiber.sibling
        }

        // 每一个 fiber 都会链接到自身的第一个子节点、下一个兄弟节点和父节点。
        if (index === 0) {
            wipFiber.child = newFiber // 第一个子节点
        } else {
            prevSibling.sibling = newFiber // 下一个兄弟节点
        }

        prevSibling = newFiber
        index++
    }
}


// /**@jsx Zeact.createElement */
// const elemet = (
//     // eslint-disable-next-line
//     <div title="foo" style="background: salmon">
//         <div>
//             <h1 title='1'>1</h1>
//             <h2 title='2'>2</h2>
//             <h3 title='3'>3</h3>
//         </div>
//         <br />
//         <h1>4</h1>
//     </div>
// )
// const elemet = Zeact.createElement(
//     'div',
//     { id: 'foo' },
//     Zeact.createElement('a', null, 'bar'),
//     Zeact.createElement('br')
// )

const container = document.getElementById('root')
// Zeact.render(elemet, container)

// const updateValue = e => {
//     rerender(e.target.value)
// }

// const rerender = value => {
//     /**@jsx Zeact.createElement */
//     const element = (
//         <div>
//             <input onInput={updateValue} value={value} />
//             <h2>Hello {value}</h2>
//         </div>
//     )
//     Zeact.render(element, container)
// }

// rerender("World")

/**@jsx Zeact.createElement */
function App(props) {
    const [count, setCount] = Zeact.useState(1)
    return <h1 onClick={() => setCount(c => c + 1)}>hi, {count},{props.name}</h1>
}
/**@jsx Zeact.createElement */
const element = <App name="foo" />
Zeact.render(element, container)